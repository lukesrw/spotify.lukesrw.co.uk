import { Request, RequestHandle } from "../../modules/host/class/Request";
import { CLIENT_ID, CLIENT_SECRET } from "../../private/configs/spotify";
import { request } from "https";
import { stringify } from "querystring";

export = async (handle: Request): Promise<Partial<RequestHandle>> => {
    let redirect_uri = "spotify.lukesrw.co.uk/login/";
    if (handle.isLocal()) {
        redirect_uri = `http://localhost:3000/${redirect_uri}`;
    } else {
        redirect_uri = `https://${redirect_uri}`;
    }

    if ("code" in handle.data.get) {
        return new Promise(resolve => {
            let grant = stringify({
                code: handle.data.get.code,
                grant_type: "authorization_code",
                redirect_uri
            });

            let token = request(
                {
                    headers: {
                        Authorization: `Basic ${Buffer.from(
                            `${CLIENT_ID}:${CLIENT_SECRET}`
                        ).toString("base64")}`,
                        "Content-Length": Buffer.byteLength(grant),
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    host: "accounts.spotify.com",
                    method: "POST",
                    path: "/api/token"
                },
                response => {
                    let data = "";

                    response
                        .on("error", async error => {
                            if (
                                !(await handle.host.jsite.sendEmit(
                                    "logger:error",
                                    error
                                ))
                            ) {
                                console.error(error);
                            }

                            return resolve({
                                data: "Error refreshing token",
                                status: "INTERNAL_SERVER_ERROR"
                            });
                        })
                        .on("data", chunk => (data += chunk))
                        .on("end", () => {
                            let keys = JSON.parse(data);

                            return resolve({
                                data: "Redirecting to application",
                                headers: {
                                    Location: `${redirect_uri
                                        .split("/")
                                        .slice(0, -2)
                                        .join("/")}?${stringify({
                                        access_token: keys.access_token,
                                        refresh_token: keys.refresh_token
                                    })}`
                                },
                                status: "TEMPORARY_REDIRECT"
                            });
                        });
                }
            );

            token.write(grant);
            token.end();
        });
    }

    return {
        data: "Redirecting to Spotify",
        headers: {
            Location: `https://accounts.spotify.com/authorize?${stringify({
                client_id: CLIENT_ID,
                redirect_uri,
                response_type: "code",
                scope:
                    "user-read-private user-read-email playlist-read-private playlist-read-collaborative"
            })}`
        },
        status: "TEMPORARY_REDIRECT"
    };
};
