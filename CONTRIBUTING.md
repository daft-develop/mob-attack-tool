# Contributing to Mob Attack Tool

Thanks for your interest in helping making this a better module!

## Issues, Bugs, Suggestions

Have an issue or think the module could use a new feature? Create a new [Github issue](https://github.com/daft-develop/mob-attack-tool/issues)!

## Language Translations

Please create a pull request if you can. If you're not familiar with Github's PR process, you can copy lang/en.json locally, translate the strings, then attach the file to a new issue and I can take it from there.

## Pull Requests and Code Contributions

Pull requests are welcome, but please open an issue first to let others and myself know what you're working on if it's a significant amount of change and we may need to go back and forth on the best way to implement new ideas/fixes

## Local Environment Setup

Here's how I'm set up for local development, as a reference. You should be able to follow along in your own local checked out copy if you want a similar setup for making and testing changes

### Prereq Tools

* VS code (as my IDE)
* prettier add-in for VS code (for auto code formatting)
* eslint and the VS code eslint plugin (for linting)
* node (for eslint)

### Tool setup

Based on <https://www.robinwieruch.de/how-to-use-prettier-vscode/>

Within your local checked out project folder:

1. `npm init` - I don't track package.json, since it's are only for eslint. Fill in whatever for your prompted options
1. `npm install eslint` - ditto on package-lock.json
1. `npm install --save-dev eslint-config-prettier eslint-plugin-prettier` - so eslint and prettier play nice
1. `.prettierrc.json`, `eslint.config.mjs`, and a local `.vscode` subfolder are tracked in the project, so VS code should use them by default when saving or manually formatting
1. [Optionally] Copy `<foundry install path>\code\resources\app\public\scripts\foundry.js` from your local Foundry installation into the root of this folder to help with autocomplete
1. A VS Code task has been set up ("Launch Edge against localhost") to attach VS code to an open browser client, assuming you're hosting Foundry locally on the default port 30000
