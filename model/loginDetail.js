const { DataTypes } = require('sequelize');
const dbConf = require('../sequelize/dbConf');

module.exports.LoginDetail = dbConf.sequelizeObj.define('login_detail', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(55),
    },
    password: {
        type: DataTypes.STRING(55),
    },
    type: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    from: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    version: {
        type: DataTypes.STRING(55)
    },
    mobileOS: {
        type: DataTypes.STRING(20)
    },
    description: {
        type: DataTypes.TEXT
    },
}, {
    timestamps: true,
    updatedAt: false,
});