
// bot.on("ready", () => {
    //fs.readFile("/tmp/lastValues.json", (err, data) => {
        //if (err) { console.log(`fs.readFile: ${err} (Starting fresh)`) }
        //else {
            //const json_data = JSON.parse(data)
            //last_soso = json_data.soso
        //}
    //})
// })

/* let sosotimeout = setInterval(() => {
	getSoSo()
}, process.env.SOSOMINUTES * 60000); */

const cheerio = require('cheerio')

let last_soso = -1

function getSoSo() {
	request.get("https://oc.mymovies.dk/em2thejay/collectionNumber:desc", async (err,res,body) => {
		if (err) { return log("getSoso", err) }
		if (res.statusCode == 200) {
			let rawHtml = body
			$ = cheerio.load(rawHtml)
			let titleList = $("li.titleCaption")
			if (titleList.length > 0) {
				let valuesToPost = []
				let isFirstElement = true
				let tempSoso
				titleList.each((index,element) => {
					if (index > 4) return false
					let number = parseInt($(element).find("p").html().trim().substring(1,4))
					let title = htmlDecode($(element).find("h3").html())
					if (number > last_soso && last_soso != -1) {
						valuesToPost[index] = {"number":number,"title":title}
					}
					if (isFirstElement) tempSoso = number
					isFirstElement = false
				})
				last_soso = tempSoso
				if (valuesToPost.length > 0) {
					valuesToPost.reverse()
					for (let obj of valuesToPost) {
						let strToPost = `Soso hat den Titel **${obj["title"]}** seiner Sammlung hinzugefügt. Dies ist der **${obj["number"]}**. Eintrag in seiner Liste. \:thumbsup:`
						tahc.send(strToPost)
						log("getSoso", obj["number"])
					}
				} else {
					log("getSoso", `No new titles found [Last no.: ${last_soso}]`)
				}
				let newObj = { soso: last_soso }
				let data = JSON.stringify(newObj)
				fs.writeFile("/tmp/lastValues.json", data, { flag: "w" }, (err) => {
					if (err) log("getSoso", err)
				})
			} else {
				log("getSoso", "No titles found")
				return false
			}
		} else {
			log("getSoso", `${res.statusCode} : ${res.statusMessage}`)
			return false
		}
	})
}

function htmlDecode(value) {
    return $("<div/>").html(value).text();
}

function findKeyinJSON(obj,key) {
    let result = null
    if (obj != null) {
        if (Array.isArray(obj)) {
            for (let i=0; i < obj.length; i++) {
                if (typeof obj[i] == "object") {
                    result = findKeyinJSON(obj[i],key)
                }
                if (result) {
                    break
                }
            }
        } else if (obj.hasOwnProperty(key)) {
            return obj[key]
        } else {
            for (let i=0; i < Object.keys(obj).length; i++) {
                if (typeof obj[Object.keys(obj)[i]] == "object") {
                    result = findKeyinJSON(obj[Object.keys(obj)[i]],key)
                }
                if (result) {
                    break
                }
            }
        }
    }
    return result
}