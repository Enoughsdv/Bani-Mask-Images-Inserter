document.getElementById('baniFile').addEventListener('change', handleBaniUpload);
document.getElementById('download').addEventListener('click', downloadBaniFile);

let baniData = null;

function handleBaniUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                baniData = parseJSON(e.target.result);
                validateBaniFile(baniData);
            } catch (error) {
                console.error('Error parsing BANI file:', error);
                alert('Error parsing BANI file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

function parseJSON(jsonString) {
    return JSON.parse(jsonString.replace(/,\s*([\]}])/g, '$1'));
}

function validateBaniFile(data) {
    const requiredProps = ['name', 'modificatedDate', 'filetype', 'options', 'sprites', 'defaults'];
    const requiredOptionsProps = ['looping', 'continuous', 'blockingbounds', 'center'];
    const requiredDefaultsProps = ['BODY', 'HEAD', 'HAT'];

    checkProperties(data, requiredProps);
    checkProperties(data.options, requiredOptionsProps, 'options.');
    checkProperties(data.defaults, requiredDefaultsProps, 'defaults.');

    if (!Array.isArray(data.options.blockingbounds) || data.options.blockingbounds.length !== 4) {
        throw new Error('Invalid blockingbounds format. Expected an array of 4 elements.');
    }

    if (!data.sprites || typeof data.sprites !== 'object') {
        throw new Error('Missing or invalid sprites property.');
    }
}

function checkProperties(obj, properties, prefix = '') {
    properties.forEach(prop => {
        if (!obj.hasOwnProperty(prop)) {
            throw new Error(`Missing property '${prefix}${prop}' in the BANI file`);
        }
    });
}

function downloadBaniFile() {
    if (!baniData) {
        alert('No BANI file loaded.');
        return;
    }

    if (!baniData.defaults.MASK) {
        baniData.defaults.MASK = 'bbuilder_enueanbumask.png';
    }

    const sprites = createMaskSprites();

    updateFramesWithMasks(sprites);

    const baniBlob = new Blob([JSON.stringify(baniData, null, 4)], { type: 'application/json' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(baniBlob);
    downloadLink.download = baniData.name.replace('.bani', '_updated.bani');
    downloadLink.click();
}

function createMaskSprites() {
    const directions = [
        { name: 'down', bounds: [0, 0, 48, 72] },
        { name: 'up', bounds: [48, 0, 48, 72] },
        { name: 'right', bounds: [96, 0, 48, 72] },
        { name: 'left', bounds: [96, 0, 48, 72], scale: [-1, 1] }
    ];

    const sprites = {};

    directions.forEach(({ name, bounds, scale }, index) => {
        const key = (Object.keys(baniData.sprites).length + index).toString();
        baniData.sprites[key] = {
            gfx: 'MASK',
            bounds,
            ...(scale && { scale })
        };
        sprites[name] = key;
    });

    return sprites;
}

function updateFramesWithMasks(sprites) {
    let headCoords = [];

    baniData.frames.forEach((frame) => {
        frame.directions = frame.directions || {};
        const [up, left, down, right] = frame.directions;

        [down, up, left, right].forEach((direction, directionIndex) => {
            direction.forEach((spriteData) => {
                const [spriteId, spriteX, spriteY] = spriteData;

                const sprite = baniData.sprites[spriteId];
                if (sprite?.gfx === "HEAD" && sprite.bounds && sprite.bounds[2] === 48 && sprite.bounds[3] === 48) {
                    const headX = spriteX;
                    const headY = spriteY;

                    let maskX = headX;
                    let maskY = headY;

                    if (directionIndex === 0) { // DOWN
                        maskY = headY - 16;
                    } else if (directionIndex === 1) { // UP
                        maskY = headY - 10;
                    } else if (directionIndex === 2) { // LEFT
                        maskX = headX - 1;
                        maskY = headY - 15;
                    } else if (directionIndex === 3) { // RIGHT
                        maskX = headX + 1;
                        maskY = headY - 15;
                    }

                    let existingCoord = headCoords.find(coord => coord.maskX === maskX && coord.maskY === maskY && coord.frame === frame);

                    if (!existingCoord) {
                        headCoords.push({ id: spriteId, maskX, maskY, direction: directionIndex, frame });
                    }
                }
            });
        });
    });

    if (headCoords.length === 0) {
        alert("No HEAD sprites with bounds 48x48 found.");
        return;
    }

    baniData.frames.forEach((frame) => {
        frame.directions = frame.directions || {};
        const [up, left, down, right] = frame.directions;

        headCoords.forEach(({ maskX, maskY, direction, frame: maskFrame }) => {
            if (maskFrame === frame) {
                if (direction === 0 && !down.some(item => item[1] === maskX && item[2] === maskY)) {
                    down.push([sprites.down, maskX, maskY]);
                } else if (direction === 1 && !up.some(item => item[1] === maskX && item[2] === maskY)) {
                    up.push([sprites.up, maskX, maskY]);
                } else if (direction === 2 && !left.some(item => item[1] === maskX && item[2] === maskY)) {
                    left.push([sprites.left, maskX, maskY]);
                } else if (direction === 3 && !right.some(item => item[1] === maskX && item[2] === maskY)) {
                    right.push([sprites.right, maskX, maskY]);
                }
            }
        });
    });
}
