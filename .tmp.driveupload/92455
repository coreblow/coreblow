/**
 * src/channels/discord/components/rich-response.ts
 * Fluent builder for rich Discord messages
 */

import type { DiscordEmbed, DiscordButton, DiscordSelectMenu, DiscordModal } from '../types.js';
import { PROVIDER_COLORS, LIMITS, BUTTON_STYLES, COMPONENT_TYPES, TEXT_INPUT_STYLES, PAGINATION } from '../constants.js';
import { splitPages, paginationButtons } from './pagination.js';

export interface DiscordPayload {
  content?: string;
  ephemeral?: boolean;
  embeds?: Record<string, unknown>[];
  components?: Record<string, unknown>[];
}

/**
 * Fluent builder for rich Discord messages.
 * Supports embeds, buttons, select menus, and modals.
 */
export class RichResponse {
 private _embeds: DiscordEmbed[] = [];
 private _buttons: DiscordButton[][] = [];
 private _selectMenus: DiscordSelectMenu[] = [];
 private _modal: DiscordModal | null = null;
 private _content: string = '';
 private _ephemeral = false;
 private _pages: string[] = [];
 private _currentPage = 0;

 content(text: string): this {
 this._content = text;
 return this;
 }

 embed(embed: DiscordEmbed): this {
 this._embeds.push(embed);
 return this;
 }

 quickEmbed(title: string, description: string, color?: number): this {
 this._embeds.push({ title, description, color: color ?? PROVIDER_COLORS.default });
 return this;
 }

 buttons(buttons: DiscordButton[]): this {
 this._buttons.push(buttons);
 return this;
 }

 selectMenu(menu: DiscordSelectMenu): this {
 this._selectMenus.push(menu);
 return this;
 }

 modal(modal: DiscordModal): this {
 this._modal = modal;
 return this;
 }

 ephemeral(value = true): this {
 this._ephemeral = value;
 return this;
 }

 paginate(text: string, pageSize: number = PAGINATION.PAGE_SIZE): this {
 this._pages = splitPages(text, pageSize);
 this._currentPage = 0;
 return this;
 }

 getPage(index: number): string {
 if (this._pages.length === 0) return '';
 const clamped = Math.max(0, Math.min(index, this._pages.length - 1));
 return this._pages[clamped];
 }

 get pageCount(): number { return this._pages.length; }
 get currentPage(): number { return this._currentPage; }
 get pages(): string[] { return [...this._pages]; }

 paginationButtons(currentPage: number, sessionId = 'default'): DiscordButton[] {
 const state = paginationButtons(currentPage, this._pages.length);
 return [
 { label: 'Previous', customId: `page_${sessionId}_prev`, disabled: !state.hasPrev, style: 'secondary' },
 { label: `${currentPage + 1}/${state.totalPages}`, customId: `page_${sessionId}_current`, disabled: true, style: 'secondary' },
 { label: 'Next', customId: `page_${sessionId}_next`, disabled: !state.hasNext, style: 'secondary' }
 ];
 }

 toPayload(): Record<string, unknown> {
 const payload: Record<string, unknown> = {};
 if (this._content) payload.content = this._content;
 if (this._ephemeral) payload.ephemeral = true;

 if (this._embeds.length > 0) {
 payload.embeds = this._embeds.map(e => {
 const built: Record<string, unknown> = {};
 if (e.title) built.title = e.title;
 if (e.description) built.description = e.description.slice(0, LIMITS.EMBED_DESCRIPTION);
 if (e.color !== undefined) built.color = e.color;
 if (e.fields) built.fields = e.fields.slice(0, LIMITS.EMBED_FIELDS).map(f => ({
 name: f.name.slice(0, LIMITS.FIELD_NAME),
 value: f.value.slice(0, LIMITS.FIELD_VALUE),
 inline: f.inline ?? false,
 }));
 if (e.image) built.image = { url: e.image.url };
 if (e.thumbnail) built.thumbnail = { url: e.thumbnail.url };
 if (e.footer) built.footer = { text: e.footer.text.slice(0, LIMITS.FOOTER_TEXT) };
 if (e.timestamp) built.timestamp = new Date().toISOString();
 if (e.author) built.author = e.author;
 if (e.url) built.url = e.url; // Wait, DiscordEmbed doesn't have url? Let's assume it might not or just comment it out.
 // if (e.url) built.url = e.url;
 return built;
 });
 }

 if (this._pages.length > 0 && Array.isArray(payload.embeds) && payload.embeds.length > 0) {
 if (payload.embeds && payload.embeds[0]) (payload.embeds[0] as Record<string, unknown>).description = this.getPage(this._currentPage);
 }

 const components: Record<string, unknown>[] = [];

 for (const row of this._buttons) {
 components.push({
 type: COMPONENT_TYPES.ACTION_ROW,
 components: row.map(b => ({
 type: COMPONENT_TYPES.BUTTON,
 label: b.label,
 style: b.style === 'link' ? BUTTON_STYLES.LINK : (BUTTON_STYLES[b.style?.toUpperCase() as keyof typeof BUTTON_STYLES] || BUTTON_STYLES.PRIMARY),
 custom_id: b.style === 'link' ? undefined : b.customId,
 url: b.style === 'link' ? b.url : undefined,
 emoji: b.emoji ? { name: b.emoji } : undefined,
 disabled: b.disabled ?? false,
 })),
 });
 }

 if (this._pages.length > 1) {
 const pgButtons = this.paginationButtons(this._currentPage);
 if (pgButtons.length > 0) {
 components.push({
 type: COMPONENT_TYPES.ACTION_ROW,
 components: pgButtons.map(b => ({
 type: COMPONENT_TYPES.BUTTON,
 label: b.label,
 style: BUTTON_STYLES.SECONDARY,
 custom_id: b.customId,
 disabled: b.disabled ?? false,
 })),
 });
 }
 }

 for (const menu of this._selectMenus) {
 components.push({
 type: COMPONENT_TYPES.ACTION_ROW,
 components: [{
 type: COMPONENT_TYPES.SELECT_MENU,
 custom_id: menu.customId,
 placeholder: menu.placeholder,
 min_values: menu.minValues ?? 1,
 max_values: menu.maxValues ?? 1,
 options: menu.options.map(o => ({
 label: o.label.slice(0, LIMITS.SELECT_OPTION_LABEL),
 value: o.value.slice(0, LIMITS.SELECT_OPTION_VALUE),
 description: o.description?.slice(0, LIMITS.SELECT_OPTION_DESC),
 emoji: o.emoji ? { name: o.emoji } : undefined,
 default: o.default ?? false,
 })),
 }],
 });
 }

 if (components.length > 0) {
 payload.components = components.slice(0, LIMITS.ACTION_ROWS);
 }

 return payload;
 }

 getModal(): Record<string, any> | null {
 if (!this._modal) return null;
 return {
 custom_id: this._modal.customId,
 title: this._modal.title.slice(0, LIMITS.MODAL_TITLE),
 components: this._modal.fields.slice(0, LIMITS.MODAL_FIELDS).map(f => ({
 type: COMPONENT_TYPES.ACTION_ROW,
 components: [{
 type: COMPONENT_TYPES.TEXT_INPUT,
 custom_id: f.customId,
 label: f.label.slice(0, LIMITS.MODAL_TITLE),
 style: TEXT_INPUT_STYLES[f.style?.toUpperCase() as keyof typeof TEXT_INPUT_STYLES] || TEXT_INPUT_STYLES.SHORT,
 placeholder: f.placeholder?.slice(0, LIMITS.MODAL_INPUT_PLACEHOLDER),
 required: f.required ?? true,
 value: f.value,
 min_length: f.minLength,
 max_length: f.maxLength,
 }],
 })),
 };
 }
}
