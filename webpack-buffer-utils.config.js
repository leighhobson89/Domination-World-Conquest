const path = require('path');

module.exports = {
    entry: {
        bufferutils: './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bufferutils-bundle.js',
        library: 'BufferGeometryUtils',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
};
