"""Test a combined image against disposable upstream API data; never production."""
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
import uuid

image = os.environ.get('CONTAINER_IMAGE', 'praesto-rustdesk-api:local')
upstream = os.environ.get('API_IMAGE', 'lejianwen/rustdesk-api:latest')
prefix = 'prc-smoke-' + uuid.uuid4().hex[:10]
data, keys = prefix + '-data', prefix + '-keys'
containers = []


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


def request(origin, path, payload=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['api-token'] = token
    body = json.dumps(payload).encode() if payload is not None else None
    with urllib.request.urlopen(urllib.request.Request(origin + path, body, headers), timeout=5) as res:
        return res.read()


def api(origin, path, payload=None, token=None):
    result = json.loads(request(origin, '/api/admin' + path, payload, token))
    assert result['code'] == 0, (path, result.get('code'), result.get('message'))
    return result['data']


def start(selected_image, suffix):
    name = prefix + suffix
    docker('run', '-d', '--name', name, '-p', '127.0.0.1::21114',
           '-v', data + ':/app/data', '-v', keys + ':/app/conf/data:ro',
           '-e', 'RUSTDESK_API_APP_REGISTER=true',
           '-e', 'RUSTDESK_API_APP_CAPTCHA_THRESHOLD=-1',
           '-e', 'RUSTDESK_API_RUSTDESK_KEY_FILE=/app/conf/data/id_ed25519.pub',
           selected_image)
    containers.append(name)
    port = json.loads(docker('inspect', name))[0]['NetworkSettings']['Ports']['21114/tcp'][0]['HostPort']
    origin = 'http://127.0.0.1:' + port
    for _ in range(45):
        try:
            api(origin, '/login-options')
            return name, origin
        except (OSError, ValueError, AssertionError):
            time.sleep(1)
    raise RuntimeError('API readiness timed out for ' + name)


try:
    docker('volume', 'create', data)
    docker('volume', 'create', keys)
    # Fixture public key only; no real server key or data is used.
    docker('run', '--rm', '-v', keys + ':/fixture', '--entrypoint', 'sh', upstream,
           '-c', "printf 'fixture-public-key' > /fixture/id_ed25519.pub")
    old, origin = start(upstream, '-upstream')
    credentials = {'username': 'container-smoke', 'password': 'fixture-password'}
    api(origin, '/user/register', {**credentials, 'confirm_password': credentials['password']})
    api(origin, '/login', credentials)
    docker('stop', old)
    print('PASS: upstream initializes persistent data and registers a fixture user')

    combined, origin = start(image, '-combined')
    html = request(origin, '/_admin/').decode()
    assert 'Praesto' in html
    asset = re.search(r'src="([^"]+\.js)"', html).group(1)
    assert len(request(origin, '/_admin/' + asset.removeprefix('./'))) > 1000
    with urllib.request.urlopen(origin + '/', timeout=5) as res:
        assert res.url.endswith('/_admin/')
    login = api(origin, '/login', credentials)
    token = login['token']
    assert api(origin, '/config/server', token=token)['key'] == 'fixture-public-key'
    identity = api(origin, '/user/current', token=token)
    assert 'container-smoke' in json.dumps(identity)
    docker('exec', combined, 'test', '-s', '/app/data/rustdeskapi.db')
    docker('exec', combined, 'test', '-d', '/app/resources/web')
    print('PASS: modern frontend/assets, root redirect, live API, persisted login, read-only key mount, browser client')
    docker('restart', combined)
    # Docker may allocate a new ephemeral host port when restarting a container.
    port = json.loads(docker('inspect', combined))[0]['NetworkSettings']['Ports']['21114/tcp'][0]['HostPort']
    origin = 'http://127.0.0.1:' + port
    for _ in range(45):
        try:
            api(origin, '/login', credentials)
            break
        except (OSError, ValueError, AssertionError):
            time.sleep(1)
    else:
        raise RuntimeError('Persisted login failed after restart')
    print('PASS: API restart preserves the fixture account')
finally:
    for name in reversed(containers):
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for volume in (data, keys):
        subprocess.run(['docker', 'volume', 'rm', volume], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
