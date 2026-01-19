const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.75, 0.9, 1.0, 1.0);

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

    // Camera toggle state
    let isPersonView = false;

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

    // Keyboard controls - movement relative to the active view
    const personSpeed = 1.0;
    const rotationSpeed = 0.05;
    const cameraSpeed = 1.5;

    scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN) return;

        const key = kbInfo.event.key.toLowerCase();

        if (isPersonView) {
            // --- First Person / Perspective Controls ---
            switch (key) {
                case "w":
                    // Move forward in the direction person is facing
                    person.position.x += Math.sin(person.rotation.y) * personSpeed;
                    person.position.z += Math.cos(person.rotation.y) * personSpeed;
                    break;
                case "s":
                    // Move backward
                    person.position.x -= Math.sin(person.rotation.y) * personSpeed;
                    person.position.z -= Math.cos(person.rotation.y) * personSpeed;
                    break;
                case "a":
                    // Rotate left
                    person.rotation.y -= rotationSpeed;
                    break;
                case "d":
                    // Rotate right
                    person.rotation.y += rotationSpeed;
                    break;
            }
        } else {
            // --- Overview Camera Panning (WASD relative to viewer) ---
            // Get camera's forward and right vectors relative to the ground plane (XZ)
            const forward = camera.getDirection(BABYLON.Axis.Z);
            forward.y = 0;
            forward.normalize();

            const right = camera.getDirection(BABYLON.Axis.X);
            right.y = 0;
            right.normalize();

            switch (key) {
                case "w":
                    camera.target.addInPlace(forward.scale(cameraSpeed));
                    break;
                case "s":
                    camera.target.subtractInPlace(forward.scale(cameraSpeed));
                    break;
                case "a":
                    camera.target.subtractInPlace(right.scale(cameraSpeed));
                    break;
                case "d":
                    camera.target.addInPlace(right.scale(cameraSpeed));
                    break;
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
                personCamera.attachControl(canvas, true);
                camera.detachControl();
            } else {
                // Switch back to overview
                scene.activeCamera = camera;
                camera.attachControl(canvas, true);
                personCamera.detachControl();
            }
        }
    });

    // Update person camera position to follow person (third-person view)
    scene.registerBeforeRender(() => {
        if (isPersonView && person) {
            // Position camera behind and above the person
            const distance = 8;
            const height = 6;
            personCamera.position.x = person.position.x - Math.sin(person.rotation.y) * distance;
            personCamera.position.y = person.position.y + height;
            personCamera.position.z = person.position.z - Math.cos(person.rotation.y) * distance;

            // Look at the person
            personCamera.setTarget(new BABYLON.Vector3(
                person.position.x + Math.sin(person.rotation.y) * 2,
                person.position.y + 3,
                person.position.z + Math.cos(person.rotation.y) * 2
            ));
        }
    });

    // --- School grounds + big school building (corner: NW) ---
    // Grounds (a fenced/outlined yard) - Extended westward with doubled width
    const schoolGround = BABYLON.MeshBuilder.CreateBox("schoolGround", { width: 343, depth: 160, height: 0.08 }, scene);
    schoolGround.position.set(-194, 0.04, 110);
    const schoolGroundMat = new BABYLON.StandardMaterial("schoolGroundMat", scene);
    schoolGroundMat.diffuseColor = new BABYLON.Color3(0.20, 0.48, 0.22);
    schoolGroundMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    schoolGround.material = schoolGroundMat;

    // Big school building - 70% of previous length, 6 floors tall, doubled width
    const school = BABYLON.MeshBuilder.CreateBox("schoolBuilding", { width: 322, depth: 56, height: 36 }, scene);
    school.position.set(-194, 18, 110);
    school.material = schoolMat;

    // School roof
    const schoolRoof = BABYLON.MeshBuilder.CreateBox("schoolRoof", { width: 326, depth: 64, height: 2.2 }, scene);
    schoolRoof.position.set(-194, 37.1, 110);
    schoolRoof.material = roofMat;

    // School wings to create E-shape from above
    // North wing (center) - extended to 3x size, height reduced to half
    const schoolWingNorth = BABYLON.MeshBuilder.CreateBox("schoolWingNorth", { width: 150, depth: 105, height: 27 }, scene);
    schoolWingNorth.position.set(-194, 13.5, 190);
    schoolWingNorth.material = schoolMat;

    const schoolWingNorthRoof = BABYLON.MeshBuilder.CreateBox("schoolWingNorthRoof", { width: 154, depth: 109, height: 2.2 }, scene);
    schoolWingNorthRoof.position.set(-194, 28.1, 190);
    schoolWingNorthRoof.material = roofMat;

    // South wing
    const schoolWingSouth = BABYLON.MeshBuilder.CreateBox("schoolWingSouth", { width: 50, depth: 35, height: 18 }, scene);
    schoolWingSouth.position.set(-194, 9, 65);
    schoolWingSouth.material = schoolMat;

    const schoolWingSouthRoof = BABYLON.MeshBuilder.CreateBox("schoolWingSouthRoof", { width: 54, depth: 39, height: 2.2 }, scene);
    schoolWingSouthRoof.position.set(-194, 19.1, 65);
    schoolWingSouthRoof.material = roofMat;

    // North side wings - West end (extended north 4x, 30% taller)
    const schoolWingNorthWest = BABYLON.MeshBuilder.CreateBox("schoolWingNorthWest", { width: 50, depth: 175, height: 23.4 }, scene);
    schoolWingNorthWest.position.set(-330, 11.7, 225);
    schoolWingNorthWest.material = schoolMat;

    const schoolWingNorthWestRoof = BABYLON.MeshBuilder.CreateBox("schoolWingNorthWestRoof", { width: 54, depth: 179, height: 2.2 }, scene);
    schoolWingNorthWestRoof.position.set(-330, 24.5, 225);
    schoolWingNorthWestRoof.material = roofMat;

    // North side wings - East end (extended north 4x, 30% taller)
    const schoolWingNorthEast = BABYLON.MeshBuilder.CreateBox("schoolWingNorthEast", { width: 50, depth: 175, height: 23.4 }, scene);
    schoolWingNorthEast.position.set(-58, 11.7, 225);
    schoolWingNorthEast.material = schoolMat;

    const schoolWingNorthEastRoof = BABYLON.MeshBuilder.CreateBox("schoolWingNorthEastRoof", { width: 54, depth: 179, height: 2.2 }, scene);
    schoolWingNorthEastRoof.position.set(-58, 24.5, 225);
    schoolWingNorthEastRoof.material = roofMat;

    // Main entrance block - centered on south side
    const schoolEntrance = BABYLON.MeshBuilder.CreateBox("schoolEntrance", { width: 30, depth: 12, height: 28.8 }, scene);
    schoolEntrance.position.set(-194, 14.4, 77);
    schoolEntrance.material = schoolMat;

    // Crucifix on top of entrance
    // Vertical post
    const crucifixVertical = BABYLON.MeshBuilder.CreateBox("crucifixVertical", { width: 2, depth: 2, height: 28.8 }, scene);
    crucifixVertical.position.set(-194, 43.2, 77);
    const crucifixMat = new BABYLON.StandardMaterial("crucifixMat", scene);
    crucifixMat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.85);
    crucifixVertical.material = crucifixMat;

    // Horizontal crossbar
    const crucifixHorizontal = BABYLON.MeshBuilder.CreateBox("crucifixHorizontal", { width: 15, depth: 2, height: 2 }, scene);
    crucifixHorizontal.position.set(-194, 48, 77);
    crucifixHorizontal.material = crucifixMat;

    // Walkway from sidewalk to entrance
    const schoolPath = BABYLON.MeshBuilder.CreateBox("schoolPath", { width: 12, depth: 50, height: 0.08 }, scene);
    schoolPath.position.set(-194, 0.05, 52);
    schoolPath.material = parkPathMat;

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
