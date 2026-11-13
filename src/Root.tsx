import React from "react";
import { Composition, Still } from "remotion";
import { ReelFilm, defaultReelFilmProps } from "./ReelFilm";
import { DevPlate, defaultDevPlateProps, devPlateSchema } from "./dev/DevPlate";
import { DevMatch, defaultDevMatchProps, devMatchSchema } from "./dev/DevMatch";
import { DevLighting, defaultDevLightingProps, devLightingSchema } from "./dev/DevLighting";
import { DevCamera, defaultDevCameraProps, devCameraSchema } from "./dev/DevCamera";
import { DevBook, defaultDevBookProps, devBookSchema } from "./dev/DevBook";
import { DevMaterials, defaultDevMaterialsProps, devMaterialsSchema } from "./dev/DevMaterials";
import { DevCovers, defaultDevCoversProps, devCoversSchema } from "./dev/DevCovers";
import { DevPages, defaultDevPagesProps, devPagesSchema } from "./dev/DevPages";
import { DevPageTurn, defaultDevPageTurnProps, devPageTurnSchema } from "./dev/DevPageTurn";
import { DevBookMotion, defaultDevBookMotionProps, devBookMotionSchema } from "./dev/DevBookMotion";
import { DevPile, defaultDevPileProps, devPileSchema } from "./dev/DevPile";
import { DevRiser, defaultDevRiserProps, devRiserSchema } from "./dev/DevRiser";
import { DevShotStrip, defaultDevShotStripProps, devShotStripSchema } from "./dev/DevShotStrip";
import { DevBench } from "./dev/DevBench";
import { BENCH_FRAMES } from "./dev/benchScenes";
import { FPS, HEIGHT, TOTAL, WIDTH } from "./config/timeline";

/**
 * Registration order matters: the film is FIRST so it is the default in the Studio and for the render scripts.
 * Dev compositions follow; each one shows one layer alone (guide 02, "Dev compositions").
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ReelFilm" component={ReelFilm} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={defaultReelFilmProps} />
    <Still id="DevPlate" component={DevPlate} width={WIDTH} height={HEIGHT} schema={devPlateSchema} defaultProps={defaultDevPlateProps} />
    <Still id="DevMatch" component={DevMatch} width={WIDTH} height={HEIGHT} schema={devMatchSchema} defaultProps={defaultDevMatchProps} />
    <Still id="DevLighting" component={DevLighting} width={WIDTH} height={HEIGHT} schema={devLightingSchema} defaultProps={defaultDevLightingProps} />
    <Still id="DevCamera" component={DevCamera} width={WIDTH} height={HEIGHT} schema={devCameraSchema} defaultProps={defaultDevCameraProps} />
    <Still id="DevBook" component={DevBook} width={WIDTH} height={HEIGHT} schema={devBookSchema} defaultProps={defaultDevBookProps} />
    <Still id="DevMaterials" component={DevMaterials} width={WIDTH} height={HEIGHT} schema={devMaterialsSchema} defaultProps={defaultDevMaterialsProps} />
    <Still id="DevCovers" component={DevCovers} width={WIDTH} height={HEIGHT} schema={devCoversSchema} defaultProps={defaultDevCoversProps} />
    <Still id="DevPages" component={DevPages} width={WIDTH} height={HEIGHT} schema={devPagesSchema} defaultProps={defaultDevPagesProps} />
    <Still id="DevPageTurn" component={DevPageTurn} width={WIDTH} height={HEIGHT} schema={devPageTurnSchema} defaultProps={defaultDevPageTurnProps} />
    <Still id="DevBookMotion" component={DevBookMotion} width={WIDTH} height={HEIGHT} schema={devBookMotionSchema} defaultProps={defaultDevBookMotionProps} />
    <Still id="DevPile" component={DevPile} width={WIDTH} height={HEIGHT} schema={devPileSchema} defaultProps={defaultDevPileProps} />
    <Still id="DevRiser" component={DevRiser} width={WIDTH} height={HEIGHT} schema={devRiserSchema} defaultProps={defaultDevRiserProps} />
    <Composition id="DevBench" component={DevBench} durationInFrames={BENCH_FRAMES.length} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Still id="DevShotStrip" component={DevShotStrip} width={WIDTH} height={HEIGHT} schema={devShotStripSchema} defaultProps={defaultDevShotStripProps} />
  </>
);
