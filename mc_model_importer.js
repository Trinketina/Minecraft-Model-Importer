(function () {
  var importAction;

  // Codec
  const MinecraftCodec = new Codec("minecraft_model", {
    name: "Java Minecraft Model Code",
    extension: "java",

    load(model, file, cb) {
      // Parse the Java code
      const parsedModel = MinecraftModelParser.parse(file.content);

      console.log("[Minecraft Model Importer] Model imported successfully");
      cb?.(true);
      try {
      } catch (error) {
        console.error("[Minecraft Model Importer]", error.message);

        Blockbench.showMessageBox({
          title: "Import Error",
          message: `Failed to import Minecraft model:\n\n${error.message}`,
        });

        cb?.(false);
      }
    },
  });

  // Parser Class
  class MinecraftModelParser {
    static generatedBones;
    static partDefinitions;

    static parse(javaCode, textureWidth = 64, textureHeight = 64) {
      javaCode = javaCode.replaceAll(/[\n]/g, "");
      this.partDefinitions = new Map();

      const startIdx = javaCode.indexOf("LayerDefinition createBodyLayer()");
      const endIdx = javaCode.indexOf("return LayerDefinition.create");

      if (startIdx === -1 || endIdx === -1) {
        throw new Error("Could not find LayerDefinition section");
      }

      javaCode = javaCode.substring(startIdx, endIdx);

      let lines = javaCode
        .split(";")
        .filter((line) => line.includes("addOrReplaceChild"));
      let builder = new ModelBuilder();

      for (const line of lines) {
        //console.log(line);
        //example line:
        // body.addOrReplaceChild("tail", CubeListBuilder.create().texOffs(44, 53).addBox(-0.5F, -0.0865F, 0.0933F, 1.0F, 6.0F, 1.0F, new CubeDeformation(0.0F)), PartPose.offsetAndRotation(0.0F, -3.0F, 1.0F, 0.5061F, 0.0F, 0.0F))

        let data = this.parseAddOrReplaceChild(line);

        builder.generateModelPart(
          data.parent,
          data.bone,
          data.cubes,
          data.partPose,
        );
      }
    }

    static parseAddOrReplaceChild(line) {
      const partDefinitionMatch = line.match(/PartDefinition\s(.*?)\s/);

      const boneMatch = line.match(/addOrReplaceChild\s*\(\s*"([^"]+)"/);
      let bone = boneMatch[1];
      console.log("bone name: " + bone);

      if (partDefinitionMatch) {
        this.partDefinitions.set(partDefinitionMatch[1], bone);
      }
      const parentMatch = line.match(/(\w+)\.addOrReplaceChild/);
      let parent = parentMatch[1];
      if (parentMatch[1].search(/([A-Z])/g) != -1) {
        parent = this.partDefinitions.get(parentMatch[1]);
      }

      console.log("parent name: " + parent);

      const cubesMatch = line.match(/CubeListBuilder\.create\(\)(.+?)PartPose/);
      let cubes = this.cubeBuilder(cubesMatch[1]);

      const poseMatch = line.match(
        /PartPose\.offsetA?n?d?R?o?t?a?t?i?o?n?\.*?\((.*?)\)/,
      );

      //splits, and then removes the "F" from each float, and turns them into Numbers
      let partPose = poseMatch[1]
        .split(",")
        .map((v) => Number(v.replace(/F/g, "").trim()));

      console.log("Part Pose: " + partPose);

      return { parent, bone, cubes, partPose };
    }

    static cubeBuilder(builderString) {
      //example builderString
      // CubeListBuilder.create().texOffs(44, 53).addBox(-0.5F, -0.0865F, 0.0933F, 1.0F, 6.0F, 1.0F, new CubeDeformation(0.0F)),
      let cubes = [];

      let cubeStrings = builderString.match(
        /\.texOffs\s*\(([^)]+)\).*?(?=\.texOffs|$)/g,
      );
      if (!cubeStrings) {
        return cubes;
      }
      for (const cubeString of cubeStrings) {
        let newCube = new CubeValues();

        let texValues = cubeString.match(/texOffs\s*\(([^)]+)\)/);
        let values = texValues[1]
          .split(",")
          .map((v) => Number(v.replace(/F/g, "").trim()));

        console.log("[MCMI] texture values: " + values);

        newCube.xTexOffs = Number(values[0]);
        newCube.yTexOffs = Number(values[1]);

        let cubeValues = cubeString.match(/addBox\s*\(([^)]+)\)/);

        values = cubeValues[1]
          .split(",")
          .map((v) => Number(v.replace(/F/g, "").trim()));

        console.log("[MCMI] cube values: " + values);

        newCube.xO = values[0];
        newCube.yO = -values[1];
        newCube.zO = values[2];
        newCube.w = values[3];
        newCube.h = values[4];
        newCube.d = values[5];

        let deformValue = cubeString.match(/CubeDeformation\s*\(([^)]+)\)/);
        if (!deformValue) {
          newCube.deformation = 0;
        } else {
          let deformation = Number(deformValue[1].replace(/F/g, "").trim());

          newCube.deformation = deformation;
        }

        //console.log("[MCMI] deformation: " + newCube.deformation);

        cubes.push(newCube);
      }

      return cubes;
    }
  }

  class ModelBuilder {
    constructor() {
      this.groups = new Map();
    }

    generateModelPart(parent = "root", child, cubes, partPose) {
      let originOffset = [0, 24, 0];
      if (!this.groups.get(child)) {
        if (this.groups.get(parent)) {
          originOffset = this.groups.get(parent).origin;
        } else {
          originOffset = [0, 24, 0];
        }

        let newGroup = new Group();
        console.log("[MCMI] bone offset and rotation: " + partPose);
        if (parent === "root") {
        }

        if (partPose.length > 4) {
          newGroup = new Group({
            child,
            name: child,
            origin: [
              -Number(partPose[0]) + originOffset[0],
              -Number(partPose[1]) + originOffset[1],
              Number(partPose[2]) + originOffset[2],
            ],
            rotation: this.radToDeg([
              -Number(partPose[3]),
              -Number(partPose[4]),
              Number(partPose[5]),
            ]),
          });
        } else {
          newGroup = new Group({
            child,
            name: child,
            origin: [
              -Number(partPose[0]) + originOffset[0],
              -Number(partPose[1]) + originOffset[1], //only negative if flipped? and only +24 if root is parent?
              Number(partPose[2]) + originOffset[2],
            ],
          });
        }
        this.groups.set(child, newGroup);

        if (this.groups.get(parent)) {
          newGroup.addTo(this.groups.get(parent));
        }

        newGroup.init();
      }
      console.log(this.groups);

      const boneGroup = this.groups.get(child);

      // create all parts
      for (const cubeValues of cubes) {
        const cube = new Cube({
          // position all parts
          from: [
            boneGroup.origin[0] - cubeValues.xO - cubeValues.w,
            boneGroup.origin[1] + cubeValues.yO - cubeValues.h,
            boneGroup.origin[2] + cubeValues.zO,
          ],
          to: [
            boneGroup.origin[0] - cubeValues.xO,
            boneGroup.origin[1] + cubeValues.yO,
            boneGroup.origin[2] + cubeValues.zO + cubeValues.d,
          ],
          uv_offset: [cubeValues.xTexOffs, cubeValues.yTexOffs],
          inflate: cubeValues.deformation,
        });

        cube.addTo(boneGroup);
        cube.init();
      }
    }

    radToDeg(rot) {
      return rot.map((v) => (v * 180) / Math.PI);
    }
  }

  // Cube Class
  class CubeValues {
    xTexOffs;
    yTexOffs;

    xO;
    yO;
    zO;

    w;
    h;
    d;

    deformation;
  }

  Plugin.register("mc_model_importer", {
    title: "Minecraft Model Importer",
    icon: "fas fa-cube",
    version: "1.0.0",
    author: "Trinketina",
    onload() {
      importAction = new Action("mcm_importer", {
        name: "Java MC Model Class",
        category: "file",
        description: "Import a Minecraft Java model source file.",
        icon: "fa-file-import",
        click() {
          Blockbench.import(
            {
              extensions: ["java", "class"],
              type: "Java Minecraft Model Code",
              readtype: "text",
            },
            (files) => {
              MinecraftCodec.load(null, files[0], (success) => {
                console.log("[Minecraft Importer] Import complete");
              });
            },
          );
        },
      });

      MenuBar.addAction(importAction, "file.import");
    },
    onunload() {
      importAction.delete();
    },
  });
})();
