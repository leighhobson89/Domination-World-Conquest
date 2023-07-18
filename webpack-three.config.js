const path = require('path');

module.exports = {
    entry: {
        cannon: './node_modules/three'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'three-bundle.js',
        library: 'THREE',
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
