"use strict";
/**
 * Core data models for Node Template Repository
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeShape = exports.TemplateStatus = void 0;
var TemplateStatus;
(function (TemplateStatus) {
    TemplateStatus["DRAFT"] = "draft";
    TemplateStatus["ACTIVE"] = "active";
    TemplateStatus["DEPRECATED"] = "deprecated";
    TemplateStatus["ARCHIVED"] = "archived";
})(TemplateStatus || (exports.TemplateStatus = TemplateStatus = {}));
var NodeShape;
(function (NodeShape) {
    NodeShape["RECTANGLE"] = "rectangle";
    NodeShape["ROUNDED"] = "rounded";
    NodeShape["CIRCLE"] = "circle";
    NodeShape["DIAMOND"] = "diamond";
    NodeShape["HEXAGON"] = "hexagon";
})(NodeShape || (exports.NodeShape = NodeShape = {}));
//# sourceMappingURL=models.js.map