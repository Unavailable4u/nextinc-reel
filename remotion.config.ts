import { Config } from "@remotion/cli/config";

// Frames are PNG so the 3D layer keeps clean edges until the final encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");

// WebGL renderer for Three.js. "angle" uses your GPU and is the setting Remotion documents for 3D.
// No GPU (or a server)? Run the Node scripts with REMOTION_GL=swangle: software rendering, many times slower.
// Concurrency: 3D frames are heavy. The render script (Patch 24) starts at 2 parallel tabs; if the browser runs out of
// memory (page textures), lower it. Do not raise it above half your CPU cores.
Config.setChromiumOpenGlRenderer("angle");
