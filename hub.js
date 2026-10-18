// Script Hub: buraya kendi ya da açık kaynak Luau script'lerini ekleyebilirsin.
const HUB = [
  {
    name: 'Merhaba Dünya',
    desc: 'Output paneline yazı basar. Bağlantıyı test etmek için.',
    code: `print("Merhaba Roblox Studio!")
for i = 1, 3 do
\tprint("Sayac:", i)
end`
  },
  {
    name: 'Renkli Part Izgarası',
    desc: 'Workspace içinde 5x5 renkli Part ızgarası oluşturur.',
    code: `local old = workspace:FindFirstChild("Grid")
if old then old:Destroy() end
local folder = Instance.new("Folder")
folder.Name = "Grid"
folder.Parent = workspace
for x = 1, 5 do
\tfor z = 1, 5 do
\t\tlocal p = Instance.new("Part")
\t\tp.Anchored = true
\t\tp.Size = Vector3.new(4, 1, 4)
\t\tp.Position = Vector3.new(x * 5, 1, z * 5)
\t\tp.Color = Color3.fromHSV((x + z) / 10, 1, 1)
\t\tp.Parent = folder
\tend
end
print("Izgara oluşturuldu")`
  },
  {
    name: 'Izgarayı Sil',
    desc: 'Yukarıdaki Grid klasörünü temizler.',
    code: `local g = workspace:FindFirstChild("Grid")
if g then g:Destroy() print("Silindi") else print("Grid yok") end`
  },
  {
    name: 'Tüm Script\'leri Listele',
    desc: 'Oyundaki bütün Script/ModuleScript yollarını yazdırır.',
    code: `local n = 0
for _, d in ipairs(game:GetDescendants()) do
\tif d:IsA("LuaSourceContainer") then
\t\tn += 1
\t\tprint(d.ClassName, d:GetFullName())
\tend
end
print("Toplam:", n)`
  },
  {
    name: 'Sınıf Sayacı',
    desc: 'Workspace içindeki nesneleri sınıfa göre sayar.',
    code: `local counts = {}
for _, d in ipairs(workspace:GetDescendants()) do
\tcounts[d.ClassName] = (counts[d.ClassName] or 0) + 1
end
for class, c in pairs(counts) do
\tprint(class, c)
end`
  },
  {
    name: 'Gece / Gündüz',
    desc: 'Lighting saatini değiştirir (Studio ışık testi).',
    code: `local L = game:GetService("Lighting")
L.ClockTime = (L.ClockTime == 14) and 0 or 14
print("ClockTime:", L.ClockTime)`
  }
];
