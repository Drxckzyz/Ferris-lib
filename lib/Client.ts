import { EventEmitter } from "events"
import { ClientOptions, createGuildOptions, Endpoints, SnowFlake } from "./Constants";
import { WebsocketManager } from "./gateway/WebsocketManager";
import { Guild } from "./models/Guild";
import { User } from "./models/User";
import { RequestHandler } from "./rest/RequestHandler";
import { StorageBox } from "./util/StorageBox";

/**
 * Main class for interacting with Api and Gateway
 * @param {ClientOptions} clientOptions The options for the client
 * @extends EventEmitter
 */
export class Client extends EventEmitter {
    /**
     * A cache that holds all the Guilds the client is apart of
     * @type {StorageBox<SnowFlake, Guild>}
     */
    public guilds: StorageBox<SnowFlake, Guild>;

    /**
     * A cache that holds all the Users that have been cached by the client
     * @type {StorageBox<SnowFlake, User>}
     */
    public users: StorageBox<SnowFlake, User>;

    /**
     * The Handler {@link RequestHandler} used for interacting with the api
     * @type {RequestHandler}
     */
    public requestHandler: RequestHandler;

    /**
     * The Manager {@link WebsocketManager} used to interacting with the Gateway
     * @type {WebsocketManager}
     */
    public ws: WebsocketManager;

    /**
     * The options passed to the client
     * @type {ClientOptions}
     */
    public options: ClientOptions;

    /**
     * @param {ClientOptions} clientOptions The options for the Client
     */
    constructor(clientOptions: ClientOptions) {
        super();

        if (!clientOptions) throw new Error("No options were provided to the client Class")
        else if (!clientOptions.token) throw new Error("No Token was provided, Please specify one.")

        this.options = Object.assign(clientOptions, {
            rest: {
                requestTimeout: 7,
                retryLimit: 1,
                retryAfter: 10,
                headers: {},
            },
            cache: {
                guilds: false,
                users: false,
            }
        })

        this.validateOptions()

        this.requestHandler = new RequestHandler(this)

        this.ws = new WebsocketManager(this)

        this.guilds = new StorageBox()

        this.users = new StorageBox()
    }

    createGuild(data: createGuildOptions): Promise<Guild> {
        if (!data.name) throw new Error("A name must be provided for Guild Creation.")
        else if (typeof data.name != "string") throw new TypeError("Name of Guild must be a string")

        return this.requestHandler.request("POST", Endpoints.GUILDS(), data)
    }

    /**
     * Fetch a Guild from the Api
     * @param {SnowFlake} id The Id for the Guild to fetch
     * @returns {Promise<Guild>} 
     */
    public fetchGuild(id: SnowFlake): Promise<Guild> {
        return this.requestHandler.request("GET", Endpoints.GUILD(id)).then((guild) => {
            const fetchedGuild = new Guild(guild, this)
            if (!this.guilds.has(id)) this.guilds.set(id, fetchedGuild)
            return fetchedGuild
        })
    }

    /**
     * Fetche a user from the api
     * @param {SnowFlake} id The id of the user
     * @param {{ cache: boolean; force: boolean }} options Whether to cache the user upon fetch or Force a request even if the user is in the cache
     * @returns {User|Promise<User>}
     */
    public fetchUser(id: SnowFlake, options?: { cache?: boolean; force?: boolean }): User | Promise<User> {
        if (!options.force && this.users.has(id)) return this.users.get(id)
        return this.requestHandler.request("GET", Endpoints.USER(id)).then((user) => {
            const fetchUser = new User(user, this)
            if (options.cache && !this.users.has(id)) this.users.set(id, fetchUser)
            return fetchUser
        })
    }

    /**
     * @private
     */
    private validateOptions() {
        if (typeof this.options.token != "string") throw new TypeError("The Token Provided is not a string.")
        if (typeof this.options.rest.retryLimit != "number" || isNaN(this.options.rest.retryLimit)) {
            throw new TypeError("The Rest Retry Limit must be a number.")
        }
        if (typeof this.options.rest.requestTimeout != "number" || isNaN(this.options.rest.requestTimeout)) {
            throw new TypeError("The Request Timeout must be a number.")
        }
        if (typeof this.options.rest.headers != "object") {
            throw new TypeError("The Rest Headers must be an object.")
        }
    }
}