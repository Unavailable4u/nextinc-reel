import React from "react";
import { Composition, Still } from "remotion";
import { ReelFilm, defaultReelFilmProps } from "./ReelFilm";
import { DevPlate, defaultDevPlateProps, devPlateSchema } from "./dev/DevPlate";
import { DevMatch, defaultDevMatchProps, devMatchSchema } from "./dev/DevMatch";
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
  </>
);
