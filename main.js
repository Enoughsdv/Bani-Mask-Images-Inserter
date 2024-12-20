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

    const initialFrameCount = Object.keys(baniData.sprites).length;
    const sprites = createNewSprites(initialFrameCount);

    updateFrames(sprites);

    console.log(baniData.frames);

    const baniBlob = new Blob([JSON.stringify(baniData, null, 4)], { type: 'application/json' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(baniBlob);
    downloadLink.download = baniData.name.replace('.bani', '_updated.bani');
    downloadLink.click();
}

function createNewSprites(initialFrameCount) {
    const sprites = {
        up: [],
        left: [],
        down: [],
        right: []
    };

    const getNextAvailableKey = (existingKeys, startKey) => {
        while (existingKeys.has(startKey.toString())) {
            startKey++;
        }
        return startKey.toString();
    };

    const existingKeys = new Set(Object.keys(baniData.sprites));
    let currentFrameKey = initialFrameCount;

    const directions = [
        { name: 'down', bounds: [0, 0, 48, 72], offsetX: getOffset('down', 'X'), offsetY: getOffset('down', 'Y') },
        { name: 'up', bounds: [48, 0, 48, 72], offsetX: getOffset('up', 'X'), offsetY: getOffset('up', 'Y') },
        { name: 'right', bounds: [96, 0, 48, 72], offsetX: getOffset('right', 'X'), offsetY: getOffset('right', 'Y') },
        { name: 'left', bounds: [96, 0, 48, 72], scale: [-1, 1], offsetX: getOffset('left', 'X'), offsetY: getOffset('left', 'Y') }
    ];

    for (const { name, bounds, scale, offsetX, offsetY } of directions) {
        const newFrameKey = getNextAvailableKey(existingKeys, currentFrameKey);
        const frameData = {
            bounds,
            gfx: 'MASK',
            ...(scale && { scale })
        };

        baniData.sprites[newFrameKey] = frameData;
        sprites[name].push(newFrameKey, offsetX, offsetY);

        currentFrameKey = parseInt(newFrameKey, 10) + 1;
        existingKeys.add(newFrameKey);
    }

    return sprites;
}

function getOffset(direction, axis) {
    const offsetInput = document.getElementById(`${direction}Offset${axis}`);
    return parseInt(offsetInput.value, 10);
}

function updateFrames(sprites) {
    for (const frame of baniData.frames) {
        const [up, left, down, right] = frame.directions;
        up.push(sprites.up);
        left.push(sprites.left);
        down.push(sprites.down);
        right.push(sprites.right);
    }
}
