import express from "express"
import nunjucks from "nunjucks"
import bodyparser from "body-parser"
import 'dotenv/config'

import shitRouter from "./routes/shitter.js"

const app = express()
const port = 3000

nunjucks.configure("views", {
    autoescape: true,
    express: app,
})

app.use(express.static("public"))
app.use(bodyparser.urlencoded({extended:true}));
app.use(bodyparser.json());

app.use("/shitter", shitRouter)

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000")
})