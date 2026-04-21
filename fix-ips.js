const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Replace single quotes API_BASE
            if (content.includes("'http://192.168.10.34:3000'")) {
                content = content.replace(/'http:\/\/192\.168\.10\.34:3000'/g, "`http://${window.location.hostname}:3000`");
                modified = true;
            }
            if (content.includes('"http://192.168.10.34:3000"')) {
                content = content.replace(/"http:\/\/192\.168\.10\.34:3000"/g, "`http://${window.location.hostname}:3000`");
                modified = true;
            }
            
            // Socket IO
            if (content.includes("'http://192.168.10.34:3000'")) {
                 content = content.replace(/'http:\/\/192\.168\.10\.34:3000'/g, "`http://${window.location.hostname}:3000`");
                 modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

replaceInDir(path.join(__dirname, 'client', 'src'));
