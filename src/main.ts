import "./styles.css";
import { mountGameApp } from "./ui/app.ts";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root.");
}

mountGameApp(appRoot);
