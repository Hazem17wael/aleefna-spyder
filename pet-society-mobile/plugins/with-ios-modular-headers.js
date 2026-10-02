const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (!podfile.includes("use_modular_headers!")) {
        podfile = podfile.replace(
          /(platform :ios,.*\n)/,
          "$1use_modular_headers!\n"
        );

        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
