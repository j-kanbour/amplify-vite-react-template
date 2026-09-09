import {defineFunction} from "@aws-amplify/backend";

export const myFunction = defineFunction({
    name: "myFunction",
    entry: "./handler.ts"
});