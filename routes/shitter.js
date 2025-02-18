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

router.get("/:id", async (request, response) => {
    
    const id = request.params.id

    const [tweet] = await pool.promise().query(`
        SELECT tweets.*, users.name, DATE_FORMAT(tweets.updated_at, "%Y-%m-%d %H:%i") AS date
        FROM tweets 
        JOIN users ON users.id = tweets.author_id 
        WHERE tweets.id = ?;
        `, [id])

    const [replies] = await pool.promise().query(`
        SELECT threads.reply_id, tweets.*, DATE_FORMAT(tweets.updated_at, "%Y-%m-%d %H:%i") AS date
        FROM threads
        JOIN tweets ON tweets.id = threads.reply_id
        JOIN users ON tweets.author_id = users.id
        WHERE threads.origin_id = ?
        ORDER BY updated_at DESC;
        `, [id])

    response.render("thread.njk", {
        replies: replies,
        tweet: tweet
    })
})

router.get("/:id/delete", async (request, response) => {
    const id = request.params.id

    await pool.promise().query(`
        DELETE FROM tweets
        WHERE id = ?
        `, [id])

        response.redirect("/shitter")
})

export default router