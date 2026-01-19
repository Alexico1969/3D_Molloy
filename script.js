const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.75, 0.9, 1.0, 1.0);
    scene.collisionsEnabled = true;

    // Camera (simple orbit camera to inspect the scene)
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        BABYLON.Tools.ToRadians(45),
        BABYLON.Tools.ToRadians(65),
        90,
        new BABYLON.Vector3(0, 8, 0),
        scene
    );
    camera.attachControl(canvas, true);
    camera.wheelDeltaPercentage = 0.01;

    // Create person-perspective camera (will be positioned later after person is created)
    const personCamera = new BABYLON.UniversalCamera("personCamera", new BABYLON.Vector3(0, 5, -10), scene);
    personCamera.wheelDeltaPercentage = 0.01;
    personCamera.minZ = 0.1; // Prevent near-plane clipping

    // Camera toggle state
    let isPersonView = false;
    let lookPitch = 0;
    const keysPressed = {};

    // Light
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.9;

    const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.6, -1.0, -0.4), scene);
    sun.position = new BABYLON.Vector3(60, 80, 60);
    sun.intensity = 0.8;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 640, height: 480 }, scene);
    ground.position.x = -200;
    ground.position.z = 120;
    const grassMat = new BABYLON.StandardMaterial("grassMat", scene);
    grassMat.diffuseColor = new BABYLON.Color3(0.25, 0.55, 0.25);
    grassMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    ground.material = grassMat;

    // --- Materials ---
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.13, 0.13, 0.14);
    roadMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    const sidewalkMat = new BABYLON.StandardMaterial("sidewalkMat", scene);
    sidewalkMat.diffuseColor = new BABYLON.Color3(0.55, 0.55, 0.58);
    sidewalkMat.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);

    const schoolMat = new BABYLON.StandardMaterial("schoolMat", scene);
    schoolMat.diffuseColor = new BABYLON.Color3(0.75, 0.72, 0.68);

    const entranceMat = new BABYLON.StandardMaterial("entranceMat", scene);
    entranceMat.diffuseColor = new BABYLON.Color3(0.65, 0.50, 0.35); // Lighter brown

    const libraryMat = new BABYLON.StandardMaterial("libraryMat", scene);
    libraryMat.diffuseColor = new BABYLON.Color3(0.68, 0.72, 0.78);

    const roofMat = new BABYLON.StandardMaterial("roofMat", scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.35, 0.18, 0.18);

    const parkPathMat = new BABYLON.StandardMaterial("parkPathMat", scene);
    parkPathMat.diffuseColor = new BABYLON.Color3(0.72, 0.64, 0.50);
    parkPathMat.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);

    const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.10, 0.35, 0.55);
    waterMat.alpha = 0.85;

    // Load a GLB model
    const loadCampusAsset = async () => {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",                      // import all meshes
            "./assets/models/",      // folder
            "traffic_light_ped.glb",   // filename
            scene
        );

        const rootMesh = result.meshes[0];
        if (rootMesh) {
            rootMesh.scaling.set(1.0, 1.0, 1.0);

            // Define positions and rotations for 4 corners (aligned to N, S, E, W)
            const corners = [
                { pos: new BABYLON.Vector3(13, 0, 13), rot: Math.PI },      // NE faces South
                { pos: new BABYLON.Vector3(-13, 0, 13), rot: Math.PI / 2 }, // NW faces East
                { pos: new BABYLON.Vector3(-13, 0, -13), rot: 0 },          // SW faces North
                { pos: new BABYLON.Vector3(13, 0, -13), rot: -Math.PI / 2 } // SE faces West
            ];

            // Setup the first one (NE)
            rootMesh.position.copyFrom(corners[0].pos);
            rootMesh.rotationQuaternion = null; // Use Euler rotation
            rootMesh.rotation.y = corners[0].rot;

            // Clone for the other 3 corners
            for (let i = 1; i < corners.length; i++) {
                const clone = rootMesh.instantiateHierarchy();
                clone.position.copyFrom(corners[i].pos);
                clone.rotationQuaternion = null;
                clone.rotation.y = corners[i].rot;
            }
        }

        result.meshes.forEach(m => {
            if (!m.getBoundingInfo) return;
            m.checkCollisions = true;
            m.freezeWorldMatrix();
        });
    };

    loadCampusAsset();

    // --- Roads: 2 streets forming an intersection ---
    // Road 1 (East-West): Goes all the way across (640 width)
    const road1 = BABYLON.MeshBuilder.CreateBox("road_east_west", { width: 640, depth: 18, height: 0.3 }, scene);
    road1.position.x = -200;
    road1.position.y = 0.15;
    road1.material = roadMat;

    // Road 2: Split into North and South segments to avoid overlap at intersection
    // Ground North edge is now at Z=360.
    // Road2North Length: (360 - 9) = 351.
    // Road2North Position Z: 9 + (351/2) = 184.5.

    const road2North = BABYLON.MeshBuilder.CreateBox("road_north", { width: 18, depth: 351, height: 0.3 }, scene);
    road2North.position.set(0, 0.15, 184.5);
    road2North.material = roadMat;

    const road2South = BABYLON.MeshBuilder.CreateBox("road_south", { width: 18, depth: 111, height: 0.3 }, scene);
    road2South.position.set(0, 0.15, -64.5);
    road2South.material = roadMat;

    // --- Street Names ---
    const createStreetLabel = (text, x, z, rotationY) => {
        const planeWidth = 30;
        const planeHeight = 10;
        const dtWidth = 512;
        const dtHeight = 128; // height matches aspect ratio roughly

        const plane = BABYLON.MeshBuilder.CreatePlane("textPlane_" + text, { width: planeWidth, height: planeHeight }, scene);
        plane.position.set(x, 0.5, z); // Raised to 0.5 to ensure it's above the road
        plane.rotation.x = BABYLON.Tools.ToRadians(90);
        plane.rotation.y = rotationY;

        const dt = new BABYLON.DynamicTexture("dynamicTexture_" + text, { width: dtWidth, height: dtHeight }, scene);
        dt.hasAlpha = true; // Explicitly enable alpha

        const mat = new BABYLON.StandardMaterial("mat_" + text, scene);
        mat.diffuseTexture = dt;
        mat.useAlphaFromDiffuseTexture = true; // Use alpha from texture
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1); // Bright text
        mat.backFaceCulling = false; // Ensure visible from both sides

        plane.material = mat;

        // Draw text (text, x, y, font, color, clearColor, invertY, update)
        // "transparent" background is crucial for road visibility
        dt.drawText(text, null, null, "bold 60px Arial", "white", "transparent", true);

        return plane;
    };

    // "Manton Street" on East-West road
    createStreetLabel("Manton St", -60, 0, 0);
    createStreetLabel("Manton St", 60, 0, 0);

    // "Main Street" on North-South road (rotated 90 degrees)
    createStreetLabel("Main St", 0, -60, BABYLON.Tools.ToRadians(90));
    createStreetLabel("Main St", 0, 60, BABYLON.Tools.ToRadians(90));

    // --- Interactive Person at intersection ---
    const personMat = new BABYLON.StandardMaterial("personMat", scene);
    personMat.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8);

    const scale = 2; // Make person 2x bigger

    // Head
    const head = BABYLON.MeshBuilder.CreateSphere("personHead", { diameter: 0.3 * scale }, scene);
    head.position.set(0, 1.65 * scale, 0);
    head.material = personMat;

    // Body
    const body = BABYLON.MeshBuilder.CreateCylinder("personBody", { diameter: 0.4 * scale, height: 0.8 * scale }, scene);
    body.position.set(0, 1.1 * scale, 0);
    body.material = personMat;

    // Left arm
    const leftArm = BABYLON.MeshBuilder.CreateCylinder("personLeftArm", { diameter: 0.1 * scale, height: 0.6 * scale }, scene);
    leftArm.position.set(-0.35 * scale, 1.0 * scale, 0);
    leftArm.rotation.z = BABYLON.Tools.ToRadians(160);
    leftArm.material = personMat;

    // Right arm
    const rightArm = BABYLON.MeshBuilder.CreateCylinder("personRightArm", { diameter: 0.1 * scale, height: 0.6 * scale }, scene);
    rightArm.position.set(0.35 * scale, 1.0 * scale, 0);
    rightArm.rotation.z = BABYLON.Tools.ToRadians(-160);
    rightArm.material = personMat;

    // Left leg
    const leftLeg = BABYLON.MeshBuilder.CreateCylinder("personLeftLeg", { diameter: 0.12 * scale, height: 0.7 * scale }, scene);
    leftLeg.position.set(-0.15 * scale, 0.35 * scale, 0);
    leftLeg.material = personMat;

    // Right leg
    const rightLeg = BABYLON.MeshBuilder.CreateCylinder("personRightLeg", { diameter: 0.12 * scale, height: 0.7 * scale }, scene);
    rightLeg.position.set(0.15 * scale, 0.35 * scale, 0);
    rightLeg.material = personMat;

    // Merge all parts into one person
    const person = BABYLON.Mesh.MergeMeshes([head, body, leftArm, rightArm, leftLeg, rightLeg], true, true, undefined, false, true);
    person.position.set(0, 0, 0);

    // Collision properties for the person - Taller/Wider bubble to prevent clipping
    person.checkCollisions = true;
    person.ellipsoid = new BABYLON.Vector3(1.2, 1.8, 1.2);
    person.ellipsoidOffset = new BABYLON.Vector3(0, 1.8, 0);

    // Make person clickable - changes color
    person.actionManager = new BABYLON.ActionManager(scene);
    person.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            function () {
                personMat.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
            }
        )
    );

    // Keyboard controls - movement state tracking
    const personSpeed = 0.2; // Adjusted for frame-based movement
    const rotationSpeed = 0.03;
    const cameraSpeed = 1.0;

    scene.onKeyboardObservable.add((kbInfo) => {
        const key = kbInfo.event.key.toLowerCase();
        if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
            keysPressed[key] = true;
        } else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
            keysPressed[key] = false;
        }
    });

    // --- Middle Mouse Look Handling ---
    scene.onPointerObservable.add((pointerInfo) => {
        if (isPersonView && pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
            const event = pointerInfo.event;
            // buttons mask 4 is the middle button
            if (event.buttons & 4) {
                // Rotate person body with horizontal mouse move
                person.rotation.y += event.movementX * 0.005;
                // Rotate view up/down with vertical mouse move
                lookPitch += event.movementY * 0.005;
                lookPitch = Math.max(-1.4, Math.min(1.4, lookPitch));
            }
        }
    });

    // Camera toggle with C key (Camera)
    scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && (kbInfo.event.key === "c" || kbInfo.event.key === "C")) {
            isPersonView = !isPersonView;
            console.log("Camera view swapped. Person perspective:", isPersonView);

            if (isPersonView) {
                // Switch to person perspective
                scene.activeCamera = personCamera;
                // We handle our own inputs for person mode
                camera.detachControl();
            } else {
                // Switch back to overview
                scene.activeCamera = camera;
                camera.attachControl(canvas, true);
            }
        }
    });

    // Update loop for movement and camera - Handle simultaneous key presses
    scene.registerBeforeRender(() => {
        const speedMultiplier = keysPressed["shift"] ? 3.0 : 1.0;

        if (isPersonView) {
            if (person) {
                // First Person Movement with Collisions
                const currentPersonSpeed = personSpeed * speedMultiplier;
                let moveVector = new BABYLON.Vector3(0, 0, 0);

                if (keysPressed["w"]) {
                    moveVector.x += Math.sin(person.rotation.y) * currentPersonSpeed;
                    moveVector.z += Math.cos(person.rotation.y) * currentPersonSpeed;
                }
                if (keysPressed["s"]) {
                    moveVector.x -= Math.sin(person.rotation.y) * currentPersonSpeed;
                    moveVector.z -= Math.cos(person.rotation.y) * currentPersonSpeed;
                }

                if (moveVector.length() > 0) {
                    person.moveWithCollisions(moveVector);
                }

                if (keysPressed["a"]) {
                    person.rotation.y -= rotationSpeed;
                }
                if (keysPressed["d"]) {
                    person.rotation.y += rotationSpeed;
                }

                // Position camera at head level (scaled height)
                const eyeHeight = 3.3;
                personCamera.position.copyFrom(person.position);
                personCamera.position.y += eyeHeight;

                // Minimal offset forward to prevent seeing back of head but staying within the collision bubble
                personCamera.position.x += Math.sin(person.rotation.y) * 0.2;
                personCamera.position.z += Math.cos(person.rotation.y) * 0.2;

                personCamera.rotation.y = person.rotation.y;
                personCamera.rotation.x = lookPitch;
            }
        } else {
            // Overview Camera Panning
            const currentCameraSpeed = cameraSpeed * speedMultiplier;
            const forward = camera.getDirection(BABYLON.Axis.Z);
            forward.y = 0;
            forward.normalize();
            const right = camera.getDirection(BABYLON.Axis.X);
            right.y = 0;
            right.normalize();

            if (keysPressed["w"]) camera.target.addInPlace(forward.scale(currentCameraSpeed));
            if (keysPressed["s"]) camera.target.subtractInPlace(forward.scale(currentCameraSpeed));
            if (keysPressed["a"]) camera.target.subtractInPlace(right.scale(currentCameraSpeed));
            if (keysPressed["d"]) camera.target.addInPlace(right.scale(currentCameraSpeed));
        }
    });

    // --- School grounds + hollow school building (corner: NW) ---
    const wallThickness = 1.0;
    const schoolHeight = 36;
    const schoolWidth = 322; // length along X
    const schoolDepth = 56;  // depth along Z
    const centerX = -194;
    const centerZ = 110;

    // Grounds
    const schoolGround = BABYLON.MeshBuilder.CreateBox("schoolGround", { width: 343, depth: 160, height: 0.08 }, scene);
    schoolGround.position.set(centerX, 0.04, centerZ);
    const schoolGroundMat = new BABYLON.StandardMaterial("schoolGroundMat", scene);
    schoolGroundMat.diffuseColor = new BABYLON.Color3(0.20, 0.48, 0.22);
    schoolGround.material = schoolGroundMat;
    schoolGround.checkCollisions = true;

    // A helper for walls
    const createWall = (name, w, h, d, x, y, z, mat = schoolMat) => {
        const wall = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        wall.position.set(x, y, z);
        wall.material = mat;
        wall.checkCollisions = true;
        return wall;
    };

    // Main Building Walls
    // North Wall (Split to create openings for the three northern wings)
    const doorW = 14;
    const doorH = 12;
    const hH = schoolHeight - doorH;

    // NW Wing Opening (at centerX - 136)
    createWall("school_n_seg1", 18, schoolHeight, wallThickness, centerX - 152, schoolHeight / 2, centerZ + schoolDepth / 2);
    createWall("school_n_door1_h", doorW, hH, wallThickness, centerX - 136, doorH + hH / 2, centerZ + schoolDepth / 2);

    // Gap between NW and Center
    createWall("school_n_seg2", 122, schoolHeight, wallThickness, centerX - 68, schoolHeight / 2, centerZ + schoolDepth / 2);

    // Center Wing Opening (at centerX)
    createWall("school_n_door2_h", doorW, hH, wallThickness, centerX, doorH + hH / 2, centerZ + schoolDepth / 2);

    // Gap between Center and NE
    createWall("school_n_seg3", 122, schoolHeight, wallThickness, centerX + 68, schoolHeight / 2, centerZ + schoolDepth / 2);

    // NE Wing Opening (at centerX + 136)
    createWall("school_n_door3_h", doorW, hH, wallThickness, centerX + 136, doorH + hH / 2, centerZ + schoolDepth / 2);
    createWall("school_n_seg4", 18, schoolHeight, wallThickness, centerX + 152, schoolHeight / 2, centerZ + schoolDepth / 2);

    // East Wall
    createWall("school_east_wall", wallThickness, schoolHeight, schoolDepth, centerX + schoolWidth / 2, schoolHeight / 2, centerZ);
    // West Wall
    createWall("school_west_wall", wallThickness, schoolHeight, schoolDepth, centerX - schoolWidth / 2, schoolHeight / 2, centerZ);
    // South Wall (Split to allow entrance from the South Wing)
    const buildingDoorWidth = 14;
    const buildingDoorHeight = 12;
    const buildingHeaderHeight = schoolHeight - buildingDoorHeight;
    const buildingSideWallWidth = (schoolWidth - buildingDoorWidth) / 2;
    createWall("school_south_wall_L", buildingSideWallWidth, schoolHeight, wallThickness, centerX - buildingDoorWidth / 2 - buildingSideWallWidth / 2, schoolHeight / 2, centerZ - schoolDepth / 2);
    createWall("school_south_wall_R", buildingSideWallWidth, schoolHeight, wallThickness, centerX + buildingDoorWidth / 2 + buildingSideWallWidth / 2, schoolHeight / 2, centerZ - schoolDepth / 2);
    // Header reaches the roof correctly (from 12 up to 36)
    createWall("school_south_wall_H", buildingDoorWidth, buildingHeaderHeight, wallThickness, centerX, buildingDoorHeight + buildingHeaderHeight / 2, centerZ - schoolDepth / 2);

    // School floor inside
    const schoolFloor = BABYLON.MeshBuilder.CreateBox("schoolFloor", { width: schoolWidth, height: 0.1, depth: schoolDepth }, scene);
    schoolFloor.position.set(centerX, 0.05, centerZ);
    schoolFloor.material = sidewalkMat;
    schoolFloor.checkCollisions = true;

    // --- Wings (Hollow) ---
    const makeHollowWing = (name, w, h, d, x, z, northMode, southMode) => {
        const dWidth = 14;
        const sw = (w - dWidth) / 2;
        const openHeight = 12;
        const headerHeight = h - openHeight;

        // North wall
        if (northMode === "door") {
            createWall(name + "_n_l", sw, h, wallThickness, x - dWidth / 2 - sw / 2, h / 2, z + d / 2);
            createWall(name + "_n_r", sw, h, wallThickness, x + dWidth / 2 + sw / 2, h / 2, z + d / 2);
            createWall(name + "_n_h", dWidth, headerHeight, wallThickness, x, openHeight + headerHeight / 2, z + d / 2);
        } else if (northMode === "solid") {
            createWall(name + "_n", w, h, wallThickness, x, h / 2, z + d / 2);
        }

        // South wall
        if (southMode === "door") {
            createWall(name + "_s_l", sw, h, wallThickness, x - dWidth / 2 - sw / 2, h / 2, z - d / 2);
            createWall(name + "_s_r", sw, h, wallThickness, x + dWidth / 2 + sw / 2, h / 2, z - d / 2);
            createWall(name + "_s_h", dWidth, headerHeight, wallThickness, x, openHeight + headerHeight / 2, z - d / 2);
        } else if (southMode === "solid") {
            createWall(name + "_s", w, h, wallThickness, x, h / 2, z - d / 2);
        }

        // East wall
        createWall(name + "_e", wallThickness, h, d, x + w / 2, h / 2, z);
        // West wall
        createWall(name + "_w", wallThickness, h, d, x - w / 2, h / 2, z);
        // Floor
        const f = BABYLON.MeshBuilder.CreateBox(name + "_f", { width: w, height: 0.1, depth: d }, scene);
        f.position.set(x, 0.05, z);
        f.material = sidewalkMat;
        f.checkCollisions = true;
    };

    // Center North Wing
    makeHollowWing("wing_center", 150, 27, 105, centerX, centerZ + 105 / 2 + schoolDepth / 2, "solid", "open");
    // South side wing (Entrance Wing - now has doors on both South and North sides)
    makeHollowWing("wing_south", 50, 18, 35, centerX, centerZ - 35 / 2 - schoolDepth / 2, "door", "door");
    // North-West Wing
    makeHollowWing("wing_nw", 50, 23.4, 175, centerX - 136, centerZ + 175 / 2 + schoolDepth / 2, "solid", "open");
    // North-East Wing
    makeHollowWing("wing_ne", 50, 23.4, 175, centerX + 136, centerZ + 175 / 2 + schoolDepth / 2, "solid", "open");

    // Roofs
    const createRoof = (name, w, d, x, y, z) => {
        const r = BABYLON.MeshBuilder.CreateBox(name, { width: w, depth: d, height: 2.2 }, scene);
        r.position.set(x, y, z);
        r.material = roofMat;
        return r;
    };
    createRoof("main_roof", schoolWidth + 4, schoolDepth + 4, centerX, 37.1, centerZ);
    createRoof("center_wing_roof", 154, 109, centerX, 28.1, 190);
    createRoof("south_wing_roof", 54, 39, centerX, 19.1, 65);
    createRoof("nw_wing_roof", 54, 179, centerX - 136, 24.5, 225);
    createRoof("ne_wing_roof", 54, 179, centerX + 136, 24.5, 225);

    // Foyer structure (taller decorative entrance)
    const entranceHeight = 28.8;
    const entranceCenterX = centerX;
    const entranceCenterZ = centerZ - schoolDepth / 2 - 6;
    const foyerDepth = 12;
    const foyerDoorWidth = 14;
    const foyerDoorHeight = 12;
    const foyerSideWidth = (30 - foyerDoorWidth) / 2;
    const foyerHeaderH = entranceHeight - foyerDoorHeight;

    // Side walls
    createWall("foyer_e", wallThickness, entranceHeight, foyerDepth, entranceCenterX + 15, entranceHeight / 2, entranceCenterZ, entranceMat);
    createWall("foyer_w", wallThickness, entranceHeight, foyerDepth, entranceCenterX - 15, entranceHeight / 2, entranceCenterZ, entranceMat);

    // South wall (with door)
    createWall("foyer_s_l", foyerSideWidth, entranceHeight, wallThickness, entranceCenterX - foyerDoorWidth / 2 - foyerSideWidth / 2, entranceHeight / 2, entranceCenterZ - foyerDepth / 2, entranceMat);
    createWall("foyer_s_r", foyerSideWidth, entranceHeight, wallThickness, entranceCenterX + foyerDoorWidth / 2 + foyerSideWidth / 2, entranceHeight / 2, entranceCenterZ - foyerDepth / 2, entranceMat);
    createWall("foyer_s_h", foyerDoorWidth, foyerHeaderH, wallThickness, entranceCenterX, foyerDoorHeight + foyerHeaderH / 2, entranceCenterZ - foyerDepth / 2, entranceMat);

    const foyerRoof = BABYLON.MeshBuilder.CreateBox("foyer_roof", { width: 30, depth: foyerDepth, height: 1 }, scene);
    foyerRoof.position.set(entranceCenterX, entranceHeight, entranceCenterZ);
    foyerRoof.material = entranceMat;
    foyerRoof.checkCollisions = true;

    // Crucifix on top of entrance
    const crucifixVertical = BABYLON.MeshBuilder.CreateBox("crucifixVertical", { width: 2, depth: 2, height: 28.8 }, scene);
    crucifixVertical.position.set(centerX, 43.2, centerZ - schoolDepth / 2 - 6);
    const crucifixMat = new BABYLON.StandardMaterial("crucifixMat", scene);
    crucifixMat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.85);
    crucifixVertical.material = crucifixMat;

    const crucifixHorizontal = BABYLON.MeshBuilder.CreateBox("crucifixHorizontal", { width: 15, depth: 2, height: 2 }, scene);
    crucifixHorizontal.position.set(centerX, 48, centerZ - schoolDepth / 2 - 6);
    crucifixHorizontal.material = crucifixMat;

    // Walkway from sidewalk to entrance
    const schoolPath = BABYLON.MeshBuilder.CreateBox("schoolPath", { width: 12, depth: 30, height: 0.08 }, scene);
    schoolPath.position.set(centerX, 0.05, 32);
    schoolPath.material = parkPathMat;
    schoolPath.checkCollisions = true;

    // --- Park (corner: SW - Swapped with Shops) ---
    const park = BABYLON.MeshBuilder.CreateBox("parkGround", { width: 322, depth: 80, height: 0.08 }, scene);
    park.position.set(-194, 0.04, -70);
    const parkMat = new BABYLON.StandardMaterial("parkMat", scene);
    parkMat.diffuseColor = new BABYLON.Color3(0.18, 0.58, 0.25);
    park.material = parkMat;

    // Park path (cross)
    const parkPath1 = BABYLON.MeshBuilder.CreateBox("parkPath1", { width: 280, depth: 6, height: 0.08 }, scene);
    parkPath1.position.set(-194, 0.05, -70);
    parkPath1.material = parkPathMat;

    const parkPath2 = BABYLON.MeshBuilder.CreateBox("parkPath2", { width: 6, depth: 70, height: 0.08 }, scene);
    parkPath2.position.set(-194, 0.051, -70);
    parkPath2.material = parkPathMat;

    // Small pond
    const pond = BABYLON.MeshBuilder.CreateCylinder("pond", { diameter: 18, height: 0.12, tessellation: 48 }, scene);
    pond.position.set(-280, 0.06, -88);
    pond.material = waterMat;

    // Trees (simple: trunk + canopy)
    const makeTree = (name, x, z) => {
        const trunk = BABYLON.MeshBuilder.CreateCylinder(name + "_trunk", { diameter: 1.1, height: 5 }, scene);
        trunk.position.set(x, 2.5, z);
        const trunkMat = new BABYLON.StandardMaterial(name + "_trunkMat", scene);
        trunkMat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.12);
        trunk.material = trunkMat;

        const canopy = BABYLON.MeshBuilder.CreateSphere(name + "_canopy", { diameter: 5 }, scene);
        canopy.position.set(x, 6, z);
        const canopyMat = new BABYLON.StandardMaterial(name + "_canopyMat", scene);
        canopyMat.diffuseColor = new BABYLON.Color3(0.12, 0.45, 0.18);
        canopy.material = canopyMat;

        return BABYLON.Mesh.MergeMeshes([trunk, canopy], true, true, undefined, false, true);
    };

    makeTree("tree1", -100, -55);
    makeTree("tree2", -250, -55);
    makeTree("tree3", -100, -85);

    // --- Library (corner: SE) ---
    const libraryLot = BABYLON.MeshBuilder.CreateBox("libraryLot", { width: 80, depth: 80, height: 0.08 }, scene);
    libraryLot.position.set(70, 0.04, -70);
    const lotMat = new BABYLON.StandardMaterial("lotMat", scene);
    lotMat.diffuseColor = new BABYLON.Color3(0.25, 0.52, 0.28);
    libraryLot.material = lotMat;

    const library = BABYLON.MeshBuilder.CreateBox("libraryBuilding", { width: 34, depth: 26, height: 14 }, scene);
    library.position.set(70, 7, -70);
    library.material = libraryMat;

    const libraryRoof = BABYLON.MeshBuilder.CreateBox("libraryRoof", { width: 38, depth: 30, height: 2.0 }, scene);
    libraryRoof.position.set(70, 14.2, -70);
    libraryRoof.material = roofMat;

    // Library entrance sign
    const sign = BABYLON.MeshBuilder.CreateBox("librarySign", { width: 14, depth: 0.8, height: 3.5 }, scene);
    sign.position.set(70, 4, -55);
    const signMat = new BABYLON.StandardMaterial("signMat", scene);
    signMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.18);
    sign.material = signMat;

    // --- Quick labels via emissive planes (no text textures; just color cues) ---
    const labelPlane = (name, x, z, w, h, color) => {
        const p = BABYLON.MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
        p.position.set(x, 14, z);
        p.rotation.y = BABYLON.Tools.ToRadians(180);
        const m = new BABYLON.StandardMaterial(name + "_mat", scene);
        m.emissiveColor = color;
        m.diffuseColor = color;
        m.specularColor = new BABYLON.Color3(0, 0, 0);

        // Disable backface culling for labels
        m.backFaceCulling = false;

        p.material = m;
        return p;
    };

    // Nice default framing
    scene.registerBeforeRender(() => {
        // Optional: very subtle day motion could go here later
    });

    return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});
