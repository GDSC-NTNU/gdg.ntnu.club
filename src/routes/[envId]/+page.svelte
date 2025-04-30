<script lang="ts">
	import { page } from '$app/state';
	import { SSE } from 'sse.js';
	import { marked } from 'marked';

	let { data } = $props();

	type Message = { role: 'user' | 'assistant'; content: string; timestamp: string };
	let messages = $state<Message[]>([]);
	let input = $state('嗨');
	let convId = $state<string | null>(null);
	let sending = $state(false);
	let composing = $state(false);
	let chatContainer: HTMLDivElement;
	let sse: SSE | null = null;
	let error = $state<string | null>(null);

	async function sendMessage() {
		error = null;
		if (sending) return;
		sending = true;
		const text = input.trim();
		if (!text) {
			sending = false;
			error = 'Please enter a message.';
			return;
		}
		input = '';
		messages = [...messages, { role: 'user', content: text, timestamp: new Date().toISOString() }];
		const envId = page.params.envId;

		let url: string;
		let body = JSON.stringify({ message: text });
		if (convId === null) {
			url = `/api/chat/${envId}/start`;
		} else {
			url = `/api/chat/${envId}/${convId}`;
		}

		let assistantContent = '';
		let newConvId = convId;

		if (sse) {
			sse.close();
		}

		sse = new SSE(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			payload: body
		});

		sse.addEventListener('message', (event: { data: string }) => {
			const data = JSON.parse(event.data);
			if (data.content) {
				assistantContent += data.content;
				if (messages[messages.length - 1]?.role === 'assistant') {
					messages[messages.length - 1].content = assistantContent;
				} else {
					messages = [
						...messages,
						{ role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() }
					];
				}
				scrollToBottom();
			}
		});

		sse.addEventListener('error', (event: any) => {
			sse?.close();
			sending = false;
			try {
				const err = JSON.parse(event.data);
				error = err.error || 'An error occurred during streaming.';
			} catch {
				error = 'An error occurred during streaming.';
			}
		});

		sse.addEventListener('abort', () => {
			sse?.close();
			sending = false;
			error = 'Stream aborted.';
		});

		sse.addEventListener('readystatechange', (event: { readyState: number }) => {
			if (event.readyState === SSE.CLOSED) {
				sending = false;
			}
		});

		sse.stream();

		if (newConvId) {
			convId = newConvId;
		}
	}

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	function renderMarkdown(content: string): string {
		const renderer = new marked.Renderer();
		const linkRenderer = renderer.link;
		renderer.link = (token) => {
			return linkRenderer
				.call(renderer, token)
				.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
		};
		const imageRenderer = renderer.image;
		renderer.image = (token) => {
			return imageRenderer
				.call(renderer, token)
				.replace(/^<img /, '<img onerror="this.style.display=\'none\'" ');
		};
		return marked(content, { renderer, async: false }).trim();
	}
</script>

<svelte:head>
	<title>{data.name}</title>
	<meta name="description" content="Chat with {data.name}" />
	<link rel="icon" href="/favicon.ico" />
</svelte:head>

<main class="mx-auto flex h-full max-w-3xl flex-col justify-center space-y-4 p-4">
	{#if error}
		<div class="alert alert-error mb-2">{error}</div>
	{/if}
	<h1 class="text-2xl font-bold">{data.name}</h1>
	<div
		bind:this={chatContainer}
		class="bg-base-200 flex h-[60vh] flex-col space-y-4 overflow-y-auto rounded-lg p-4"
	>
		{#each messages as msg}
			{#if msg.role === 'user'}
				<div class="chat chat-end">
					<div class="chat-bubble chat-bubble-primary">{msg.content}</div>
				</div>
			{:else}
				<div class="chat chat-start">
					<div class="chat-bubble chat-bubble-neutral">
						{@html renderMarkdown(msg.content)}
					</div>
				</div>
			{/if}
		{/each}
	</div>
	<div class="flex space-x-2">
		<input
			value={input}
			oninput={(e) => (input = e.currentTarget.value)}
			onkeydown={(e) => !composing && e.key === 'Enter' && sendMessage()}
			oncompositionstart={() => (composing = true)}
			oncompositionend={() => (composing = false)}
			placeholder="輸入訊息..."
			autocomplete="off"
			class="input input-bordered flex-1"
		/>
		<button onclick={sendMessage} class="btn btn-primary" disabled={sending}>
			{#if sending}
				<span class="loading loading-spinner loading-xs"></span>
			{/if}
			Send
		</button>
	</div>
	<!-- add notice for ai information -->
	<div class="mt-2 text-right text-sm text-gray-500">
		<p>
			根據常識，語言模型可能會胡言亂語，<br
				class="sm:hidden"
			/>對於重要資訊請從多個來源判斷其正確性。
		</p>
	</div>
</main>
