import express from "express"
import pool from "../db.js"

const router = express.Router()

router.get("/", async (request, response) => {

    const [tweets] = await pool.promise().query(`
        SELECT tweets.*, users.name, DATE_FORMAT(tweets.updated_at, "%Y-%m-%d %H:%i") AS date
        FROM tweets
        JOIN users ON tweets.author_id = users.id;
        `)

    response.render("index.njk", {
        title: "Shitter",
        tweets: tweets
        }
    )
})

export default router