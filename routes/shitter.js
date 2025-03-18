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

    const result = await pool.promise().query(`
        INSERT INTO tweets (author_id, message)
        VALUES (?, ?)`,
        [author_id, message]
    )

    try {
        //if new tweet is reply, redirect to ID of origin and create thread link
        var redirect_id = request.body.origin_id
        await pool.promise().query(`
            INSERT INTO threads (origin_id, reply_id)
            VALUES (?, ?)
            `, [redirect_id, result[0].insertId])
    }
    catch(err) {
        //if new tweet isnt reply, origin_id doesnt exist and redirect_id is handled differently
        var redirect_id = result[0].insertId
    }
    
    response.redirect("/shitter/" + redirect_id)
})

router.get("/:id/edit", async (request, response) => {
    const id = request.params.id

    const [old_content] = await pool.promise().query(`
        SELECT tweets.message
        FROM tweets
        WHERE tweets.id = ?
        `, [id])

    console.log(old_content)

    response.render("editform.njk", {
        title: "Edit tweet",
        old_content: old_content[0].message,
        tweet_id: [id]
    })
})

router.post("/:id/edit", async (request, response) => {
    const new_content = request.body.new_content
    const id = request.params.id
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ")

    await pool.promise().query(`
        UPDATE tweets
        SET tweets.message = ?, updated_at = ?
        WHERE tweets.id = ?;
        `, [new_content, timestamp, id])

    console.log(id, new_content)

    response.redirect(`/shitter/${id}`)
})

router.get("/:id", async (request, response) => {
    
    const origin_id = request.params.id

    const [tweet] = await pool.promise().query(`
        SELECT tweets.*, users.name, DATE_FORMAT(tweets.updated_at, "%Y-%m-%d %H:%i") AS date
        FROM tweets 
        JOIN users ON users.id = tweets.author_id 
        WHERE tweets.id = ?;
        `, [origin_id])

    const [replies] = await pool.promise().query(`
        SELECT threads.reply_id, users.name, tweets.*, DATE_FORMAT(tweets.updated_at, "%Y-%m-%d %H:%i") AS date
        FROM threads
        JOIN tweets ON tweets.id = threads.reply_id
        JOIN users ON tweets.author_id = users.id
        WHERE threads.origin_id = ?
        ORDER BY updated_at DESC;
        `, [origin_id])

    const [authors] = await pool.promise().query(`
        SELECT * FROM users`)

    response.render("thread.njk", {
        title: tweet[0].name + "'s tweet",
        replies: replies,
        tweet: tweet,
        origin_id: origin_id,
        authors: authors
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

router.get("/login", async (request, response) => {
    response.render("login.njk", {
        title: "login page",

    })
})

router.post("/login", async (request, response) => {
    const password = request.params.password
    const username = request.params.username

    const user = await pool.promise().query(`
        SELECT * FROM users
        WHERE users.name = ?
        `, [username])

    bcrypt.compare(password, user.password, function(err, result){
        console.log(result)
    })
})

router.get("/user/new", async (request, response) => {
    response.render("createuser.njk", {
        title: "create new user",
    })
})

router.post("/user/new", async (request, response) => {
    password = request.params.password
    username = request.params.username

    console.log(password, username)

    const result = await pool.promise().query(`
        INSERT INTO users (name, password)
        VALUES (?, ?)
        `, {
            username,
            password
        })

    response.redirect("/user/" + result[0].insertId)
})

router.get("/user/:id", async (request, response) => {
    
})

export default router