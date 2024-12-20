document.getElementById('baniFile').addEventListener('change', handleBaniUpload);
document.getElementById('download').addEventListener('click', downloadBaniFile);

let baniData = null;

function handleBaniUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

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

    console.log('BANI file validated successfully:', data);
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

    return directions.reduce((sprites, { name, bounds, scale }, index) => {
        const key = (Object.keys(baniData.sprites).length + index).toString();
        baniData.sprites[key] = {
            gfx: 'MASK',
            bounds,
            ...(scale && { scale })
        };
        sprites[name] = key;
        return sprites;
    }, {});
}

function updateFramesWithMasks(sprites) {
    let headCoords = [];

    baniData.frames.forEach(frame => {
        frame.directions = frame.directions || {};
        const [up, left, down, right] = frame.directions;

        [down, up, left, right].forEach((direction, directionIndex) => {
            direction.forEach(spriteData => {
                const [spriteId, spriteX, spriteY] = spriteData;
                const sprite = baniData.sprites[spriteId];

                if (sprite?.gfx === "HEAD" && sprite.bounds[2] === 48 && sprite.bounds[3] === 48) {
                    const headX = spriteX;
                    const headY = spriteY;

                    let maskX = headX, maskY = headY;
                    if (directionIndex === 0) maskY -= 16;  // DOWN
                    if (directionIndex === 1) maskY -= 10;  // UP
                    if (directionIndex === 2) { maskX -= 1; maskY -= 15; }  // LEFT
                    if (directionIndex === 3) { maskX += 1; maskY -= 15; }  // RIGHT

                    if (!headCoords.some(coord => coord.id === spriteId && coord.direction === directionIndex)) {
                        headCoords.push({ id: spriteId, headX, headY, maskX, maskY, direction: directionIndex });
                    }
                }
            });
        });
    });

    if (!headCoords.length) {
        alert("No HEAD sprites with bounds 48x48 found.");
        return;
    }

    baniData.frames.forEach(frame => {
        frame.directions = frame.directions || {};
        const [up, left, down, right] = frame.directions;

        headCoords.forEach(({ maskX, maskY, direction }) => {
            if (direction === 0) down.push([sprites.down, maskX, maskY]);
            if (direction === 1) up.push([sprites.up, maskX, maskY]);
            if (direction === 2) left.push([sprites.left, maskX, maskY]);
            if (direction === 3) right.push([sprites.right, maskX, maskY]);
        });
    });
}
