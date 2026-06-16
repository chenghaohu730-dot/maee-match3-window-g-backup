import "./styles.css";
import { mountGameApp } from "./ui/app.ts";
import { mountAnimationCalibration } from "./ui/animationCalibrationView.ts";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root.");
}

const debugMode = new URLSearchParams(window.location.search).get("debug");

if (debugMode === "animation-calibration") {
  mountAnimationCalibration(appRoot);
} else {
  mountGameApp(appRoot);
}
