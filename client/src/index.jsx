// client/src/index.jsx

import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

ReactDOM.createRoot(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById("root")
);
