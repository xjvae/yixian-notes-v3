// 全局弹窗独立窗口入口（不使用 Router，直接渲染指定弹窗组件）
// 由独立窗口加载 popup.html，通过 window.__POPUP_ACTION__ / 事件 popup:action 指定弹窗类型。
import { createRoot } from "react-dom/client";
import "./index.css";
import GlobalPopup from "./components/popup/GlobalPopup";

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

createRoot(root).render(<GlobalPopup />);