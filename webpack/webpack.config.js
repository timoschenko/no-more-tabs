const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const dirSrc = path.resolve(__dirname, "..", "src");
module.exports = {
    // mode: "production",
    mode: 'development',
    devtool: 'inline-source-map',
    entry: {
        popup: path.resolve(dirSrc, "popup.ts"),
        settings: path.resolve(dirSrc, "settings.ts"),
    },
    output: {
        path: path.join(__dirname, "..", "dist"),
        filename: "[name].js",
        clean: true, // Clean the output directory before execute
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: path.resolve(dirSrc),
                to: path.resolve(__dirname, "..", "dist"),
                globOptions: {
                    ignore: [
                        "**/*.ts",
                    ],
                },
            },
            {
                from: path.resolve(__dirname, "..", "images"),
                to: path.resolve(__dirname, "..", "dist", "images"),
            },
            {
                from: path.resolve(__dirname, "..", "manifest.json"),
                to: path.resolve(__dirname, "..", "dist"),
            },
        ]
        }),
    ],
};