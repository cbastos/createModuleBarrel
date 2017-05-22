
var glob = require('glob'),
    async = require('async'),
    chalk = require('chalk'),
    pathManager = require('path'),
    fs = require('fs');
    
console.log(chalk.bgGreen.white.bold("@Plain Concepts -> Creating application barrel, please wait..."));
let startTime = new Date();

glob("**/*.module.ts", { ignore: ["node_modules/**/*.ts"] }, function (err, files) {
    files.forEach(function (moduleFile) {
        var elements = { components: {}, pipes: {}, directives: {}, providers: {} };
        console.log(chalk.green(`Processing module: ${moduleFile}`))
        var moduleFolder = pathManager.dirname(moduleFile);
        glob(moduleFolder + "/**/*.ts", { ignore: ["**/*.spec.ts", "**/*.barrel.ts", "**/*.e2e.ts"] }, function (err, files) {
            console.log(chalk.blue(`Found ${files.length} target files in ${moduleFile}`))
            fillAliases(elements, files, moduleFolder, _ => {
                writeModuleBarrel(elements, moduleFile, moduleFolder);
                console.log(chalk.bgGreen.white.bold(`Done! Elapsed time: ${new Date().getTime() - startTime} ms`));
            });
        });
    });
});

function fillAliases(elements, files, moduleFolder, cb) {
    let filePromises = [];
    files.forEach(function (filePath) {
        let promise = new Promise((res, rej) => {
            console.log(chalk.cyan(`Processing file: ${pathManager.basename(filePath)} `));
            var chunk = fs.readFileSync(filePath, { encoding: 'utf8' });
            var aliasInfo = getAliasOf(chunk, filePath, moduleFolder);
            if (aliasInfo) {
                aliasInfo.forEach(alias => {
                    elements[alias.category][alias.alias] = alias.path;
                });
            }
            res();
        });

        filePromises.push(promise);
    });

    Promise.all(filePromises).then(values => cb());

}

function getAliasOf(chunk, filePath, moduleFolder) {
    let matchedComponents = [];
    var matches = chunk.match(/(@Injectable|@Component|@Directive|@NgModule|@Pipe)\(\{?(.*\r?\n?){5}\}?\)(.*\r?\n)(export class \w*)/g);
    if (matches) {
        for (var i = 0; i < matches.length; i++) {
            var currentMatch = matches[i];
            var componentInfo = getComponentInformation(currentMatch);
            var category = getComponentCategory(componentInfo.componentType);
            if (category !== "") {
                var classStartPosition = currentMatch.search("export class");
                var alias = currentMatch.substring(classStartPosition).split("{")[0].split("export class")[1].trim();
                var tsPath = ".\\" + pathManager.relative(moduleFolder, filePath);
                tsPath = tsPath.substring(0, tsPath.length - 3).split("\\").join("/")
                matchedComponents.push({ alias: alias, path: tsPath, category: category });
            }
        }
    }

    return matchedComponents;
}

function getComponentCategory(chunk) {
    var category = '';
    if (chunkHasA(chunk, /@Component/)) {
        category = "components";
    } else if (chunkHasA(chunk, /@Pipe/)) {
        category = "pipes";
    } else if (chunkHasA(chunk, /@Directive/)) {
        category = "directives";
    } else if (chunkHasA(chunk, /@Injectable/)) {
        category = "providers";
    } else if (chunkHasA(chunk, /@NgModule/)){
        category = "modules";
    }
    return category;
}

function getComponentInformation(matchedString) {
    var matchedParts = matchedString.split(' ');
    return {
        componentType: matchedParts[0],
        componentName: matchedParts[matchedParts.length - 1]
    };
}

function chunkHasA(chunk, regex) {
    return chunk.search(regex) !== -1;
}

function writeModuleBarrel(elements, moduleFile, moduleFolder, callback) {
    var componentsBarrelInfo = getElementsBarrel(elements.components),
        pipesBarrelInfo = getElementsBarrel(elements.pipes),
        directivesBarrelInfo = getElementsBarrel(elements.directives),
        providersBarrelInfo = getElementsBarrel(elements.providers),
        modulesBarrelInfo = getElementsBarrel(elements.modules),
        componentsImports =
            `${componentsBarrelInfo.imports}
${pipesBarrelInfo.imports}
${directivesBarrelInfo.imports}
${providersBarrelInfo.imports}
${modulesBarrelInfo.imports}

export const COMPONENTS = [
    ${componentsBarrelInfo.list}
];

export const PIPES = [
    ${pipesBarrelInfo.list}
];

export const DIRECTIVES = [
    ${directivesBarrelInfo.list}
];

export const PROVIDERS = [
    ${providersBarrelInfo.list}
];

export const MODULES = [
    ${modulesBarrelInfo.list}
];

export { 
    ${componentsBarrelInfo.list}
    ${pipesBarrelInfo.list}
    ${directivesBarrelInfo.list}
    ${providersBarrelInfo.list}
    ${modulesBarrelInfo.list}
}`;

    barrelName = pathManager.basename(moduleFile).split(".")[0];

    fs.writeFileSync(`${moduleFolder}/${barrelName}.barrel.ts`, componentsImports, { encoding: 'utf8' });

    var logger = logExportedElements(elements);
    logger('components');
    logger('providers');
    logger('directives');
    logger('pipes');

}

function logExportedElements(elementsObject) {
    return function (identifier) {
        elementsObject[identifier] & console.log(chalk.green.bold(`Exported ${identifier}: ${Object.keys(elementsObject[identifier]).length}`));
    }

}
function getElementsBarrel(elements) {
    var imports = '',
        list = '';
    for (var element in elements) {
        imports += `import {\n ${element}\n} from '${elements[element]}'; \n`;
        list += element + ",\n";
    }
    return { imports, list }
}