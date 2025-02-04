import express, { request } from "express"
import pool from "../db.js"

const router = express.Router()

router.get("/", async (request, response) => {

    const [tweets] = await pool.promise().query(`
        SELECT tweets.*, users.name, DATE_FORMAT(tweets.updated_at, "%Y-%m-%d %H:%i") AS date
        FROM tweets
        JOIN users ON tweets.author_id = users.id
        ORDER BY updated_at DESC;
        `)

    response.render("index.njk", {
        title: "Shitter",
        tweets: tweets
        }
    )
})

router.get("/post", async (request, response) => {

    const [authors] = await pool.promise().query(`
        SELECT * FROM users`)

    response.render("creationform.njk", {
        title: "Create new tweet",
        authors: authors
    })
})

router.post("/", async (request, response) => {

    const author_id = request.body.author
    const message = request.body.content

    await pool.promise().query(`
        INSERT INTO tweets (author_id, message)
        VALUES (?, ?)`,
        [author_id, message]
    )
    
    response.redirect("/shitter")
})

export default router