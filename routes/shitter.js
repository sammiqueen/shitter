import express from "express"
import pool from "../db.js"
import bcrypt from "bcrypt"

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
        SELECT tweets.* FROM tweets
        WHERE tweets.id = ?
        `, [id])

    console.log(old_content)

    //if user is logged in and their ID is the same as that of the author of the tweet: 
    //render the page 
    //otherwise redirect back
    try {
        if (request.session.loggedin == true & request.session.userid == old_content.author_id) {
            response.render("editform.njk", {
                title: "Edit tweet",
                old_content: old_content[0].message,
                tweet_id: [id]
            })
        }
        else {
            request.session.errormessage = "Not logged in as user, authenticate?"
            response.redirect("back")
        }
    }
    catch (err) {
        request.session.errormessage = "Internal Server Error: hashing error"
        response.redirect("back")
    }
})

router.post(`/:id/edit`, async (request, response) => {
    const id = request.params.id
    const [old_tweet] = await pool.promise().query(`
            SELECT tweets.* FROM tweets
            WHERE tweets.id = ?
        `, [id])

    try {
        if (request.session.loggedin == true & request.session.userid == old_tweet.author_id) {
            const new_content = request.body.new_content
            const timestamp = new Date().toISOString().slice(0, 19).replace(`T`, ` `)
        
            await pool.promise().query(`
                UPDATE tweets
                SET tweets.message = ?, updated_at = ?
                WHERE tweets.id = ?;
                `, [new_content, timestamp, id])
        
            console.log(id, new_content)
        
            response.redirect(`/shitter/${id}`)
        }

        else {
            request.session.errormessage = "Not logged in as user, authenticate?"
            response.redirect("back")
        }
    }

    catch (err) {
        request.session.errormessage = "Internal Server Error: hashing error"
        response.redirect("back")
    }
})

router.get(`/:id`, async (request, response) => {
    
    const origin_id = request.params.id

    try {
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
            title: tweet[0].name + `'s tweet`,
            replies: replies,
            tweet: tweet,
            origin_id: origin_id,
            authors: authors
        })
    }

    catch(err) {
        request.session.errormessage = "Internal Server Error: tweet does not exist"
        response.redirect("back")
    }
})

router.get("/:id/delete", async (request, response) => {
    const [tweet] = await pool.promise().query(`
            SELECT tweets.* FROM tweets
            WHERE id = ?
        `, [request.params.id])

    try {
        if (request.session.loggedin & request.session.userid == tweet[0].author_id) {
            await pool.promise().query(`
                DELETE FROM tweets
                WHERE id = ?
                `, [id])
        
            response.redirect("/shitter")
        }
        else {
            request.session.errormessage = "Not logged in as user, authenticate?"
            response.redirect("back")
        }
    }

    catch (err) {
        request.session.errormessage = "Internal server error: Session Error"
        response.redirect("back")
    }
})

router.get("/user/login", async (request, response) => {
    response.render(`login.njk`, {
        title: "login page",

    })
})

router.post("/user/login", async (request, response) => {
    const password = request.body.password
    const username = request.body.username

    const [user] = await pool.promise().query(`
        SELECT users.* FROM users
        WHERE users.name = ?
        `, [username])

    console.log(password, username, user[0].password)

    bcrypt.compare(password, user[0].password, function(err, result){
        if (err) {
            console.log(err)
            request.session.errormessage = "Internal Server Error: hashing error"
            response.redirect("back")
        }
        else {
            if (result) {
                request.session.loggedin = true
                request.session.userid = user[0].id
                
                response.redirect("/shitter/user/" + user[0].id)
            }
            else {
                response.session.errormessage = "Credential Error: incorrect credentials"
                response.redirect("back")
            }
        }
    })
})

router.get("/user/new", async (request, response) => {
    response.render(`createuser.njk`, {
        title: `create new user`,
    })
})

router.post("/user/new", async (request, response) => {
    const username = request.body.username
    const password = request.body.password

    bcrypt.hash(password, 10, async (err, hash) => {
        if (err) {
            console.log(err)
            response.session.errormessage = "Internal Server Error: hashing error"
            response.redirect("back")
        }
        else {
            console.log(hash)
            const result = await pool.promise().query(`
                INSERT INTO users (name, password)
                VALUES (?, ?);
                `, [
                    username,
                    hash
                ]
            )

            request.session.loggedin = true
            request.session.userid = result[0]

            console.log("Redirecting to /user/" + result[0])
            response.redirect("shitter/user/" + result[0].insertId)
        }
    })
})

router.get("/user/:id", async (request, response) => {
    const userID = request.params.id

    try {
        const [user] = await pool.promise().query(`
            SELECT users.* FROM users
            WHERE id = ?
            `, userID)
        
        const [tweets] = await pool.promise().query(`
            SELECT tweets.* FROM tweets
            WHERE author_id = ?
            `, userID)
    
        response.render(`userpage.njk`, {
            username: user[0].name,
            tweets: tweets,
            title: user[0].name + `'s profile`
        })
    }
    catch(err) {
        response.session.errormessage = "Internal Server Error: user does not exist"
        response.redirect("back")
    }
    
})

export default router