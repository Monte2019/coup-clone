import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import App from "./App";


// const root = ReactDOM.createRoot(document.getElementById("root"));
// root.render(<App />);

ReactDOM.render(
 <BrowserRouter>
   <App />
</BrowserRouter>,
   document.getElementById("root")
);