"use client";

import tileManager from '../tileManager';

export const hexSize = 180;

export const hexToPixel = (q, r) => {
    return tileManager.hexToPixel(q, r);
};

export const pixelToHex = (x, y) => {
    return tileManager.pixelToHex(x, y);
};

// Simple markdown renderer
export const renderMarkdown = (text) => {
    if (!text) return '';

    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^• (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br/>');

    return { __html: html };
};