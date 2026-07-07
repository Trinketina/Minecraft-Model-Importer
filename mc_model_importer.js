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

    static parse(javaCode, textureWidth = 64, textureHeight = 64) {
      javaCode.replaceAll(/[\n]/g, "");

      javaCode = javaCode.substring(
        javaCode.indexOf("LayerDefinition createBodyLayer()"),
        javaCode.indexOf("return LayerDefinition.create"),
      );

      let lines = javaCode.split(";");
      let builder = new ModelBuilder();

      for (const line of lines) {
        console.log(line);
        if (line.search("addOrReplaceChild") === -1) {
          continue;
        }
        //example line:
        // body.addOrReplaceChild("tail", CubeListBuilder.create().texOffs(44, 53).addBox(-0.5F, -0.0865F, 0.0933F, 1.0F, 6.0F, 1.0F, new CubeDeformation(0.0F)), PartPose.offsetAndRotation(0.0F, -3.0F, 1.0F, 0.5061F, 0.0F, 0.0F))

        let camelCaseName = line.substring(
          0,
          line.indexOf(".addOrReplaceChild"),
        );
        camelCaseName = camelCaseName.substring(camelCaseName.lastIndexOf(" "));
        camelCaseName = camelCaseName.trim();

        //convert camelCase variables into the snake_case names
        let parentName = "";
        for (let i = 0; i < camelCaseName.length; i++) {
          if (
            camelCaseName.charAt(i) === camelCaseName.charAt(i).toUpperCase()
          ) {
            parentName += "_";
          }
          parentName += camelCaseName.charAt(i).toLowerCase();
        }

        console.log("[MCMI] parent name: " + parentName);

        let methodVariables = line.substring(
          line.indexOf("addOrReplaceChild("),
          line.lastIndexOf(")"),
        );
        methodVariables = methodVariables.substring(
          methodVariables.indexOf("(") + 1,
        );

        let boneName = methodVariables.substring(
          0,
          methodVariables.indexOf(","),
        );
        boneName = boneName.replaceAll('"', "");
        boneName = boneName.trim();

        console.log("[MCMI] bone name: " + boneName);

        let cubeListBuilderMethod = methodVariables.substring(
          methodVariables.indexOf("CubeListBuilder.create()"),
          methodVariables.indexOf("PartPose"),
        );

        let cubes = this.cubeBuilder(cubeListBuilderMethod);

        let offsetAndRotation = methodVariables.substring(
          methodVariables.indexOf("PartPose"),
        );
        offsetAndRotation = offsetAndRotation.substring(
          offsetAndRotation.indexOf("(") + 1,
          offsetAndRotation.indexOf(")"),
        );

        offsetAndRotation = offsetAndRotation.replaceAll("F", "");

        let partPose = offsetAndRotation.split(","); //should be 6 values, offset x,y,z, rotation x,y,z

        builder.generateModelPart(parentName, boneName, cubes, partPose);
      }
    }

    static cubeBuilder(builderString) {
      //example builderString
      // CubeListBuilder.create().texOffs(44, 53).addBox(-0.5F, -0.0865F, 0.0933F, 1.0F, 6.0F, 1.0F, new CubeDeformation(0.0F)),
      let cubes = [];

      let cubeStrings = builderString.split("texOffs");

      for (const cubeString of cubeStrings) {
        if (cubeString.search("addBox") === -1) {
          continue;
        }

        let newCube = new CubeValues();

        let texValues = cubeString.substring(
          cubeString.indexOf("(") + 1,
          cubeString.indexOf(")"),
        );
        texValues.replaceAll("F", "");
        let values = texValues.split(",");

        console.log("[MCMI] texture values: " + values);

        newCube.xTexOffs = Number(values[0]);
        newCube.yTexOffs = Number(values[1]);

        let cubeValues = cubeString.substring(
          cubeString.indexOf("addBox") + 7,
          cubeString.indexOf("CubeDeformation"),
        );

        cubeValues = cubeValues.replaceAll("F", "");

        values = cubeValues.split(",");

        console.log("[MCMI] cube values: " + values);

        newCube.xO = Number(values[0]);
        newCube.yO = -Number(values[1]);
        newCube.zO = Number(values[2]);
        newCube.w = Number(values[3]);
        newCube.h = Number(values[4]);
        newCube.d = Number(values[5]);

        let deformValue = cubeString.substring(
          cubeString.indexOf("CubeDeformation"),
        );
        deformValue = deformValue.substring(
          deformValue.indexOf("(") + 1,
          deformValue.indexOf(")"),
        );

        deformValue = deformValue.replaceAll("F", "");

        newCube.deformation = Number(deformValue);

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
