import express from "express"
import db from "../db-sqlite.js"
import bcrypt from "bcrypt" 
import session from "express-session"

const router = express.Router()

router.get("/", async (request, response) => {

    const [tweets] = await db.all(`
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
    response.render("creationform.njk", {
        title: "Create new tweet",
    })
})

router.post("/", async (request, response) => {

    if (!request.session.userid) redirect(req.get("Referrer") || "/")
    const author_id = request.body.author
    const message = request.body.content

    try {
        let result = await db.run(`
            INSERT INTO tweets (author_id, message)
            VALUES (?, ?)`,
            request.session.userid, message
        )
        console.log(result)

        const inThread = request.body.origin_id

        if (inThread) {
            await db.run(`
                INSERT INTO threads (origin_id, reply_id)
                VALUES (?, ?)
                `, [inThread, result[0].insertId])
                return redirect("/shitter/" + inThread)
        }

        response.redirect(`/shitter/` + result[0].insertId)
    }
    catch(err) {
        console.log("failed result check thing")

        request.status(400).send("err")
    }


})

router.get("/:id/edit", async (request, response) => {
    const id = request.params.id
    const [old_content] = await db.get(`
        SELECT tweets.* FROM tweets
        WHERE tweets.id = ? LIMIT 1
        `, id)

    //if user is logged in and their ID is the same as that of the author of the tweet: 
    //render the page 
    //otherwise redirect back
    if (!request.session.loggedin || !(request.session.userid == old_content[0].author_id)){
        request.session.errormessage = "Not logged in as user, authenticate?"
        return response.redirect(request.get("Referrer") || "/")
    }
    
    response.render("editform.njk", {
    title: "Edit tweet",
    old_content: old_content,
    tweet_id: [id]
    })
})

router.post("/:id/edit", async (request, response) => {
    const id = request.params.id
    const [old_content] = await db.get(`
        SELECT tweets.* FROM tweets
        WHERE tweets.id = ? LIMIT 1
        `, id)
    const new_content = request.body.new_content

    
    if (!request.session.loggedin || !(request.session.userid == old_content[0].author_id)) {
        console.log(old_content, request.session.loggedin, request.session.userid)
        request.session.errormessage = "Not logged in as user, authenticate?"
        console.log("error at post(/id/edit)")
        return response.redirect(request.get("Referrer") || "/")
    }

        const timestamp = new Date().toISOString().slice(0, 19).replace(`T`, ` `)
    
        await pool.promise().query(`
            UPDATE tweets
            SET tweets.message = ?, updated_at = ?
            WHERE tweets.id = ?;
            `, [new_content, timestamp, id])
    
        console.log(id, new_content)
        
        response.redirect("/shitter/" + id)
    
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
        response.redirect(req.get("Referrer") || "/")
    }
})

router.get("/:id/delete", async (request, response) => {
    const [tweet] = await pool.promise().query(`
            SELECT tweets.* FROM tweets
            WHERE id = ?
        `, [request.params.id])

    if (!request.session.loggedin || !(request.session.userid == tweet[0].author_id)) {
        request.session.errormessage = "Not logged in as user, authenticate?"
        return response.redirect(req.get("Referrer") || "/")
    }

    await pool.promise().query(`
        DELETE FROM tweets
        WHERE id = ?
        `, [id])

    response.redirect("/shitter")
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
            response.redirect(req.get("Referrer") || "/")
        }
        else {
            if (result) {
                request.session.loggedin = true
                request.session.userid = user[0].id
                console.log(request.session.userid)
                
                response.redirect("/shitter/user/" + user[0].id)
            }
            else {
                request.session.errormessage = "Credential Error: incorrect credentials"
                response.redirect(req.get("Referrer") || "/")
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
            request.session.errormessage = "Internal Server Error: hashing error"
            response.redirect(req.get("Referrer") || "/")
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
        request.session.errormessage = "Internal Server Error: user does not exist"
        response.redirect(req.get("Referrer") || "/")
    }
    
})

export default router