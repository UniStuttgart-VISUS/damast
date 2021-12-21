import { accept_dialog } from '../common/dialog';

export async function GET(
  url: string
): Promise<any> {
  try {
    const f = await fetch(url);
    if (!f.ok) {
      const body = await f.text();
      await accept_dialog(f.statusText,
        `<p>The GET request to <code>${encodeURI(url)}</url> failed with the code <strong>${f.statusText}</strong>:</p><p>${body}</p>`,
        {});
      throw new Error(f.statusText);
    }

    return await f.json();
  } catch (err) {
    await accept_dialog(`An ${err.name} occurred during fetch or response decode`,
        `<p>${err.message}</p>`,
        {});
    throw err;
  }
}

export async function PUT(
  url: string,
  payload: any,
  response_is_json: boolean = true,
): Promise<any> {
  try {
    const { headers, body } = (typeof payload === 'object')
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      : { headers: { 'Content-Type': 'text/plain' }, body: payload };

    const f = await fetch(url, {
      headers, body,
      method: 'PUT',
    });
    if (!f.ok) {
      const body = await f.text();
      await accept_dialog(f.statusText,
        `<p>The PUT request to <code>${encodeURI(url)}</url> failed with the code <strong>${f.statusText}</strong>:</p><p>${body}</p>`,
        {});
      throw new Error(f.statusText);
    }

    if (response_is_json) return await f.json();
  } catch (err) {
    await accept_dialog(`An ${err.name} occurred during fetch or response decode`,
        `<p>${err.message}</p>`,
        {});
    throw err;
  }
}

export async function PATCH(
  url: string,
  payload: any
): Promise<void> {
  try {
    const f = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!f.ok) {
      const body = await f.text();
      await accept_dialog(f.statusText,
        `<p>The PATCH request to <code>${encodeURI(url)}</url> failed with the code <strong>${f.statusText}</strong>:</p><p>${body}</p>`,
        {});
      throw new Error(f.statusText);
    }
  } catch (err) {
    await accept_dialog(`An ${err.name} occurred during fetch or response decode`,
        `<p>${err.message}</p>`,
        {});
    throw err;
  }
}

export async function DELETE(
  url: string
): Promise<any> {
  try {
    const f = await fetch(url, { method: 'DELETE' });
    if (!f.ok) {
      const body = await f.text();
      await accept_dialog(f.statusText,
        `<p>The DELETE request to <code>${encodeURI(url)}</url> failed with the code <strong>${f.statusText}</strong>:</p><p>${body}</p>`,
        {});
      throw new Error(f.statusText);
    }

    return await f.json();
  } catch (err) {
    await accept_dialog(`An ${err.name} occurred during fetch or response decode`,
        `<p>${err.message}</p>`,
        {});
    throw err;
  }
}
