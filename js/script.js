/*global request*/

"use strict";

var MAX_ARTISTS = 50;

var url = new URLSearchParams(window.location.search);
var auth = {
    Authorization: "Bearer " + url.get("access_token")
};

var user;
var header;
var main;
var url_to_items = {};
var id_to_playlist = null;

/**
 *
 * @param {object} options request options
 * @param {function} callback to complete
 * @param {object[]} items collected
 * @returns {void}
 */
function getAll(options, callback, items) {
    if (typeof items === "undefined") items = [];

    if (Object.prototype.hasOwnProperty.call(url_to_items, options.url)) {
        return callback(null, url_to_items[options.url]);
    }

    return request(options, function (error, response) {
        if (error) return callback(error);

        items = items.concat(response.items);

        if (items.length === response.total) {
            url_to_items[options.url] = items;

            return callback(null, items);
        }

        options.data = options.data || {};
        options.data.offset = response.offset || options.data.offset || 0;
        options.data.offset += options.data.limit || response.limit;

        return getAll(options, callback, items);
    });
}

/**
 * @param {string[]} artists array of artist ids
 * @param {function} callback to complete
 * @param {object[]} items collected
 * @returns {void}
 */
function getAllArtists(artists, callback, items) {
    if (typeof items === "undefined") items = [];

    if (artists.length === 0) return callback(null, items);

    return request(
        {
            data: {
                ids: artists.splice(0, MAX_ARTISTS).join(",")
            },
            headers: auth,
            url: "https://api.spotify.com/v1/artists"
        },
        function (error, _artists) {
            if (error) return callback(error);

            return getAllArtists(
                artists,
                callback,
                items.concat(_artists.artists)
            );
        }
    );
}

/**
 * @param {string} id playlist id
 * @returns {void}
 */
function getPlaylist(id) {
    $(main).empty();

    if (
        Object.prototype.hasOwnProperty.call(id_to_playlist, id) &&
        id_to_playlist[id].tracks.length
    ) {
        main.appendChild(
            $.create({
                innerText: 'Actions for "' + id_to_playlist[id].name + '"',
                tag: "span"
            })
        );

        return main.appendChild(
            $.create({
                children: [
                    {
                        children: [
                            {
                                dataset: {
                                    id: id
                                },
                                href: "javascript:void 0",
                                innerText: "Get Artists",
                                onclick: function (e) {
                                    id_to_playlist[
                                        e.target.closest("a").dataset.id
                                    ].getArtists();
                                },
                                tag: "a"
                            }
                        ],
                        tag: "li"
                    }
                ],
                tag: "ul"
            })
        );
    }

    return getAll(
        {
            headers: auth,
            url: "https://api.spotify.com/v1/playlists/" + id + "/tracks"
        },
        function (error, tracks) {
            if (error) window.location.href = "..";

            id_to_playlist[id].tracks = tracks;
            getPlaylist(id);
        }
    );
}

/**
 * @param {string} properties for playlist
 * @returns {Playlist} instance
 */
function Playlist(properties) {
    var that = this;

    Object.keys(properties).forEach(function (key) {
        that[key] = properties[key];
    });

    that._getArtists = null;
    that.getArtists = function () {
        var artists = [];

        if (that._getArtists) {
            $(main).empty();

            return main.appendChild(
                $.create({
                    children: that._getArtists.map(function (artist) {
                        var image = {};
                        if (artist.images.length) {
                            image = {
                                loading: "lazy",
                                src: artist.images[0].url,
                                tag: "img"
                            };
                        }

                        return {
                            children: [
                                {
                                    children: [
                                        image,
                                        {
                                            innerText: artist.name,
                                            tag: "span"
                                        }
                                    ],
                                    href: "javascript:void 0",
                                    tag: "a"
                                }
                            ],
                            tag: "li"
                        };
                    }),
                    className: "img-list",
                    tag: "ul"
                })
            );
        }

        id_to_playlist[that.id].tracks.forEach(function (track) {
            track.track.artists.forEach(function (artist) {
                if (artists.indexOf(artist.id) === -1) {
                    artists.push(artist.id);
                }
            });
        });

        return getAllArtists(artists, function (error, artists) {
            that._getArtists = artists;
            that.getArtists();
        });
    };
}

/**
 *
 * @returns {void}
 */
function getPlaylists() {
    if (id_to_playlist) {
        $(main).empty();

        return main.appendChild(
            $.create({
                children: Object.values(id_to_playlist).map(function (
                    playlist
                ) {
                    return {
                        children: [
                            {
                                children: [
                                    {
                                        loading: "lazy",
                                        src: playlist.images[0].url,
                                        tag: "img"
                                    },
                                    {
                                        innerText: playlist.name,
                                        tag: "span"
                                    }
                                ],
                                dataset: {
                                    id: playlist.id
                                },
                                href: "javascript:void 0",
                                onclick: function (e) {
                                    getPlaylist(
                                        e.target.closest("a").dataset.id
                                    );
                                },
                                tag: "a"
                            }
                        ],
                        tag: "li"
                    };
                }),
                className: "img-list",
                tag: "ul"
            })
        );
    }

    return getAll(
        {
            data: {
                limit: 50
            },
            headers: auth,
            url: "https://api.spotify.com/v1/me/playlists"
        },
        function (error, playlists) {
            if (error) window.location.href = "..";

            id_to_playlist = {};

            playlists
                .filter(function (playlist) {
                    return playlist.owner.id === user.id;
                })
                .forEach(function (playlist) {
                    id_to_playlist[playlist.id] = new Playlist(playlist);
                });

            getPlaylists();
        }
    );
}

document.addEventListener("DOMContentLoaded", function () {
    var link;

    header = document.getElementById("header");
    main = document.getElementById("main");

    if (url.get("access_token")) {
        return request(
            {
                headers: auth,
                url: "https://api.spotify.com/v1/me/"
            },
            function (error, _user) {
                if (error) window.location.href = "..";

                user = _user;

                header.appendChild(
                    $.create({
                        children: [
                            "Welcome ",
                            {
                                href: "javascript:void 0",
                                innerText: user.display_name,
                                onclick: getPlaylists,
                                tag: "a"
                            },
                            ","
                        ],
                        tag: "h2"
                    })
                );

                getPlaylists();
            }
        );
    }

    link = document.createElement("a");
    link.href = "./login/";
    link.innerText = "Login with Spotify";

    document.body.appendChild(link);
});
