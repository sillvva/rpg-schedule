import http from "http";
import bodyParser from "body-parser";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(cookieParser());

/**
 * EJS
 */
app.set("view engine", "ejs");
app.set("views", "views");

// Initialize the Discord event handlers and then call a
// callback function when the bot has logged in.
// Return the client to pass to the app routing logic.
const server = http.createServer(app).listen(process.env.PORT || 5000);

/**
 * Routes
 */

app.use("/", (req: any, res, next) => {
  res.render("moved");
});