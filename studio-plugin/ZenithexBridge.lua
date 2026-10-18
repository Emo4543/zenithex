--!nocheck
-- Zenithex - Bridge (Studio eklentisi)
-- Masaüstü uygulamasından gelen kodu KENDİ Roblox Studio'nda çalıştırır.
-- Kurulum: Studio > Plugins > Plugins Folder'a at, Studio'yu yeniden başlat.
-- İlk bağlanışta Studio, 127.0.0.1 için HTTP izni ister: Allow de.

local HttpService = game:GetService("HttpService")
local URL = "http://127.0.0.1:34872"

local toolbar = plugin:CreateToolbar("Zenithex")
local btn = toolbar:CreateButton("HubBridge", "Zenithex uygulamasına bağlan / bağlantıyı kes", "", "Bridge")
btn.ClickableWhenViewportHidden = true

local connected = false

local function post(kind, msg)
	pcall(function()
		HttpService:RequestAsync({
			Url = URL .. "/result",
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({ kind = kind, msg = tostring(msg) }),
		})
	end)
end

local function pack(...)
	local p = table.pack(...)
	for i = 1, p.n do
		p[i] = tostring(p[i])
	end
	return table.concat(p, " ")
end

local function run(src)
	local fn, err = loadstring(src, "=hub")
	if not fn then
		post("error", "Derleme hatası: " .. tostring(err))
		return
	end
	local env = setmetatable({
		print = function(...) post("print", pack(...)) end,
		warn = function(...) post("warn", pack(...)) end,
	}, { __index = getfenv(0) })
	setfenv(fn, env)
	local ok, e = xpcall(fn, function(m)
		return tostring(m) .. "\n" .. debug.traceback()
	end)
	post(ok and "info" or "error", ok and "✔ Bitti." or e)
end

local function loop()
	while connected do
		local ok, res = pcall(function()
			return HttpService:RequestAsync({ Url = URL .. "/poll", Method = "GET" })
		end)
		if ok and res.Success then
			local okJ, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
			if okJ and data.code then
				task.spawn(run, data.code)
			end
			task.wait(0.3)
		else
			task.wait(2)
		end
	end
end

btn.Click:Connect(function()
	connected = not connected
	btn:SetActive(connected)
	if connected then
		task.spawn(loop)
	end
end)
