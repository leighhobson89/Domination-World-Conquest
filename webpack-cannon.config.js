const path = require('path');

module.exports = {
    entry: {
        cannon: './node_modules/cannon-es'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'cannon-bundle.js',
        library: 'CANNON',
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
