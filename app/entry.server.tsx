import type { AppLoadContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough, Readable } from 'stream';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

function renderStream(element: React.ReactElement): Promise<ReadableStream<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const pipeable = renderToPipeableStream(element, {
      onShellReady() {
        const nodeStream = new PassThrough();
        pipeable.pipe(nodeStream);
        resolve((Readable as any).toWeb(nodeStream));
      },
      onError(err) {
        console.error(err);
        reject(err);
      },
    });
  });
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  const webStream = await renderStream(<RemixServer context={remixContext} url={request.url} />);

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });
      controller.enqueue(
        new TextEncoder().encode(
          `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
        ),
      );

      const reader = webStream.getReader();

      function pump() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new TextEncoder().encode('</div></body></html>'));
              controller.close();
              return;
            }

            controller.enqueue(value);
            pump();
          })
          .catch((error) => {
            controller.error(error);
            webStream.cancel();
          });
      }
      pump();
    },
    cancel() {
      webStream.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    // Optional: Add bot-specific handling here if needed.
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
