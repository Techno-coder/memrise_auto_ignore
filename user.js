// ==UserScript==
// @name         Memrise Auto-Ignore
// @namespace    https://techno-coder.github.io
// @version      0.1
// @description  Identifies already learned words and ignores them
// @author       Technocoder
// @match        https://www.memrise.com/course/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.notification
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@2/src/js.cookie.min.js
// ==/UserScript==

let $ = window.jQuery;
const KEY_STORE = "collected_items";

(() => {
	if (is_garden_page()) return;
	setup_authentication();

	$(".dropdown-menu").append(`<li><a id="auto_ignore"><i class="ico"></i> Auto Ignore</a></li>`);
	$(".dropdown-menu").append(`<li><a id="collect"><i class="ico ico-water"></i> Collect</a></li>`);

	if (is_course_page()) {
		$("#collect").click(async () => collect_notification(await collect_course()));
		$("#auto_ignore").click(async () => ignore_notification(await ignore_course()));
	} else {
		$("#collect").click(async () => collect_notification(await collect_level($(".thing"))));
		$("#auto_ignore").click(async () => ignore_notification(await ignore_level($(".thing"), stripped_url())));
	}
})();

function setup_authentication() {
	$.ajaxSetup({
		beforeSend: (header) => {
			let token = Cookies.get("csrftoken");
			header.setRequestHeader("X-CSRFToken", token);
		}
	});
}

function stripped_url() {
	let current_url = window.location.href;
	return current_url.substr(0, current_url.lastIndexOf('/'));
}

function is_course_page() {
	let url = stripped_url();
	let page_identifier = url.substr(url.lastIndexOf('/') + 1);
	return isNaN(page_identifier);
}

function is_garden_page() {
	return window.location.href.includes("garden");
}

async function ignore_course() {
	let ignore_count = 0;
	let promises = [];
	$(".level").each(async (_index, level) => {
		let level_url = $(level).attr("href");
		promises.push($.get(level_url, async (page_data) => {
			let page = $($.parseHTML(page_data));
			let items = page.find(".thing");
			ignore_count += await ignore_level(items, level_url);
		}));
	});
	await Promise.all(promises);
	return ignore_count;
}

async function ignore_level(items, level_url) {
	let key_store = await get_key_store();
	let ignore_count = 0;
	items.each((_index, item) => {
		let item_status = $(item).children(".thinguser").children();
		if (not_learned(item_status)) {
			let key = $(item).children(".col_a").children(".text").text();
			if (key_store.has(key)) {
				$(item).find(":checkbox").prop("checked", true);
				ignore_count++;
			}
		}
	});
	simulate_save(items, level_url);
	return ignore_count;
}

async function simulate_save(items, level_url) {
	let ignore_data = [];
	items.each((_index, item) => {
		ignore_data.push({
			learnable_id: parseInt($(item).attr("data-learnable-id"), 10),
			ignored: $(item).find(":checkbox").prop("checked"),
		});
	});

	let ignore_data_string = JSON.stringify(ignore_data);
	let payload = { ignore_data: ignore_data_string };
	await $.post(`${level_url}/ajax/ignore_learnables/`, payload);
}

async function collect_course() {
	let collect_count = 0;
	let promises = [];
	$(".level").each(async (_index, level) => {
		let level_url = $(level).attr("href");
		promises.push($.get(level_url, async (page_data) => {
			let page = $.parseHTML(page_data);
			collect_count += await collect_level($(page).find(".thing"));
		}));
	});
	await Promise.all(promises);
	return collect_count;
}

async function collect_level(items) {
	let key_store = await get_key_store();
	let collect_count = 0;
	items.each((_index, item) => {
		let item_status = $(item).children(".thinguser").children();
		if (not_learned(item_status) || item_status.text() == "Ignored") return;

		let key = $(item).children(".col_a").children(".text").text();
		if (!key_store.has(key)) {
			key_store.add(key);
			collect_count++;
		}
	});

	await GM.setValue(KEY_STORE, JSON.stringify(Array.from(key_store)));
	return collect_count;
}

async function get_key_store() {
	let raw_key_store = await GM.getValue(KEY_STORE, "[]");
	return new Set(JSON.parse(raw_key_store));
}

function not_learned(item_status) {
	return item_status.hasClass("ico-purple");
}

function ignore_notification(ignore_count) {
	let notification = {
		text: `Ignored ${ignore_count} already learned words`,
		title: "Memrise Auto-Ignore",
		timeout: "3000",
	};
	GM.notification(notification);
}

function collect_notification(collect_count) {
	let notification = {
		text: `Added ${collect_count} newly learned words`,
		title: "Memrise Auto-Ignore",
		timeout: "3000",
	};
	GM.notification(notification);
}