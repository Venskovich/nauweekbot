// Setting up telegram bot
const TelegramApi = require("node-telegram-bot-api")
const token = require("./token")
const bot = new TelegramApi(token, { polling: true })

// Getting data from files to operate with
const fs = require("fs")
var mode = require("./mode")
var devId = require("./devId")
var chats = require("./chats")
var stats = require("./stats")
var users = require("./users")
var banlist = require("./banlist")



// Setting up commands
bot.setMyCommands([
    { command: "/nauweek", description: "Який наразі навчальний тиждень?" },
    { command: "/readme", description: "Додатковий функціонал" }
])

// Creating these variables to make it easier to operate with commands
var commands = {
    nauweek: "/nauweek",
    readme: "/readme",

    stats: "/stats",
    chats: "/chats",
    invert: "/invert",

    start: "/start",
}
var allCommands = ["/nauweek", "/nauweek@nauweekbot", "/readme", "/readme@nauweekbot", "/start", "/start@nauweekbot"]
var devCommands = ["/stats", "/stats@nauweekbot", "/chats", "/chats@nauweek", "/invert", "/invert@nauweekbot"]



// Main
bot.on("message", msg => {

    // Creating these variables to make it easier to operate with message
    let text = msg.text.toLowerCase()
    let chatId = msg.chat.id
    let msgId = msg.message_id
    let userId = msg.from.id
    let user = msg.from

    // Developer commands
    if (devCommands.includes(text) && userId === devId) {

        if (text.includes(commands.stats)) {

            sendMessage(chatId, getStats())

        } else if (text.includes(commands.chats)) {

            sendMessage(chatId, getChats()) 

        } else if (text.includes(commands.invert)) {

            sendMessage(chatId, invert())
            saveMode()

        }

        // Deleting messages
        deleteMessages(chatId, msgId, true, 10)
        return

    }


    // If a message is not a command request, then ignore it and do not execute the following code
    // The same is if message was sent by bot
    if (!allCommands.includes(text) || user.is_bot) {
        return
    }


    // Antiflood system
    if (allCommands.includes(text)) {

        // Checking if this userId is already banned. If true, then ignore user
        if (isUserBanned(userId)) {

            deleteMessages(chatId, msgId, false)
            return

        }

        let msgTime = Math.floor(Date.now() / 1000)

        // Checking if this userId is in users array already
        if (isThereUser(userId)) {

            // Getting the user
            let user = getUser(userId)

            // If user has called commands more than 3 times less than 3 second between them
            // then push him to banlist
            if (user.warnings >= 3) {

                banlist.push(userId)
                sendMessage(chatId, `<a href="tg://user?id=${userId}">Користувач</a> доданий до чорного списку на добу`)

                deleteMessages(chatId, msgId, false)
                saveBanlist()

                return

            }

            // If user has called bot command less then 3 seconds from the last call,
            // then increase his warnings
            if ((msgTime - user.lastMsgTime) <= 3) {
                user.warnings++;
            }

            // Setting time when this the last command request was called
            user.lastMsgTime = msgTime

            // Saving users data
            saveUsers()

        } else {

            // Creating user profile
            let user = {
                id: userId,
                lastMsgTime: msgTime,
                warnings: 0
            }

            // Pushing this user to users array
            users.push(user)

            // Saving users
            saveUsers()

        }

    }

    // Main bot commands
    if (text.includes(commands.nauweek)) {

        sendMessage(chatId, nauweek())

        // Increasinng stats counter and adding a chat to chats list
        stats++

        if (!chats.includes(chatId)) {

            chats.push(chatId)

            // Saving chats array
            saveChats()

        }

        // Saving stats counter
        saveStats()

    } else if (text.includes(commands.readme)) {

        sendMessage(chatId, readme())

    } else if (text.includes(commands.start)) {

        sendMessage(chatId, start())

        // A user calls this command 90% times at private messages with the bot, when getting acquinted with it. Clearing up all messages means autodelete the chat from chatlist of the user. So it is mandatory not to delete the bot answer
        deleteMessages(chatId, msgId, false)
        return

    }


    // Deleting messages
    deleteMessages(chatId, msgId)

})



// Function to get message of what studying week it is now
function nauweek() {

    // Getting date and week
    let date = new Date()
    let week = whatWeek(date.getWeek())

    // getDay() function sets Sunday as the first day of the week, so
    // if it is Sun-0, Sat-6 or Fri-5, add to the message that the week is ending up
    // Otherwise just send what week it is now
    if ([0, 5, 6].includes(date.getDay())) {
        return `Закінчується ${week}-ий тиждень`
    } else {
        return `Наразі ${week}-ий тиждень`
    }
    
}

// Function to calculate number of studying week
function whatWeek(weekNum) {

    if (weekNum % 2 === 0) {
        return mode ? 1 : 2
    } else {
        return mode ? 2 : 1
    }
    
}



// Function to get readme message
function readme() {
    return "Бот запобігає флуду, видаляючи надіслані команди та їх результат протягом хвилини. Задля цього, надайте @nauweekbot статус адміністратора групи із можливістю видалення повідомлень"
}

// Function to get start message
function start() {
    return "Вітаю! Додай бота до чату та через команду /nauweek дізнайся, який наразі навчальний тиждень\n\nРозробник: @Venskovich\n*За підтримки СР НАУ"
}



// Developer command / Function to get stats info
function getStats() {
    return `stats: ${stats}`
}

// Developer command / Function to get chats counter
function getChats() {
    return `chats: ${chats.length}`
}

// Developer command / To invert week numbers
function invert() {

    // Inverting week number
    if (mode) {
        mode = false
    } else {
        mode = true
    }

    return `Нумерація тижнів змінена`

}


// Antiflood / Renew users and banlist every midnight
setTimeout(function () {

    users = []
    banlist = []
    saveData()

    setInterval(function () {

        users = []
        banlist = []
        saveData()
    
    }, 24 * 60 * 60 * 1000)

}, delayToMidnight())

// Function to calculate delay to midnight, so users and banlist arrays could renew at midnight every day
function delayToMidnight() {

    let thisDay = new Date()
    let nextDay = new Date()

    nextDay.setDate(thisDay.getDate() + 1)
    nextDay.setHours(0, 0, 0, 0)

    return nextDay.getTime() - thisDay.getTime()

}

// Antiflood / Function to check if there is this userId in users array
function isThereUser(userId) {

    for (user of users) {
        if (user.id === userId) {
            return true
        }
    }

    return false

}

// Antiflood / Function to get user
function getUser(userId) {

    for (user of users) {
        if (user.id === userId) {
            return user
        }
    }

    return false
}

// Antiflood / Function to check if a user is banned
function isUserBanned(userId) {

    for (id of banlist) {
        if (id === userId) {
            return true
        }
    }

    return false

}



// Simplified way to send a message
function sendMessage(chatId, text) {
    bot.sendMessage(chatId, text, { parse_mode: "HTML" })
}

// Function to clear up user command request message and bot's reply
function deleteMessages(chatId, msgId, deleteReply = true, delay = 60) {

    setTimeout(function () {
        bot.deleteMessage(chatId, msgId)
    }, 1 * 1000)

    if (deleteReply) {

        setTimeout(function () {
            bot.deleteMessage(chatId, ++msgId)
        }, delay * 1000)

    }

}

// Functions to save data
function saveStats() {
    fs.writeFile("stats.json", JSON.stringify(stats), err => {
        if (err) throw err; // Checking for errors
    })
}
function saveChats() {
    fs.writeFile("chats.json", JSON.stringify(chats), err => {
        if (err) throw err; // Checking for errors
    })
}
function saveUsers() {
    fs.writeFile("users.json", JSON.stringify(users), err => {
        if (err) throw err; // Checking for errors
    })
}
function saveBanlist() {
    fs.writeFile("banlist.json", JSON.stringify(banlist), err => {
        if (err) throw err; // Checking for errors
    })
}
function saveMode() {
    fs.writeFile("mode.json", JSON.stringify(mode), err => {
        if (err) throw err; // Checking for errors
    })
}


// Special added function to find out which week number it is now
// This function doesn't exist in basic list of Date object methods
// Imported from the internet
Date.prototype.getWeek = function () {

    var date = new Date(this.getTime())
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
    var week1 = new Date(date.getFullYear(), 0, 4)
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)

}