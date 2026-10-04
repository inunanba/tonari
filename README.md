# TONARI / となり

並ぶ時間を、となりの人との小さな共同体験に。

ピンクのひよこ **もも** と、ラベンダーのひよこ **るる** が、ハートのピースを分けあう体験を案内します。話さなくても、一枚から。交換しないで眺めるだけでも大丈夫。

開発チェックポイント **0.8**。全体は制作中で、提出可能な完成版ではありません。

## 試す

Node24以上。画面は外部サービスなしで動きます。開発テスト用の依存関係を先に導入します。

```sh
npm ci --ignore-scripts
npm test
npm run demo
```

- `/apps/web/index.html`：それぞれが別の鍵を持つ3端末のデモ。左から交換を頼み、中央で確認します。
- `/apps/web/exchange.html`：となりの端末と、QRで交換の約束を交わします。画像からの読み取りは端末内で処理します。
- `/apps/web/operations.html`：模擬の混雑入力で、配布を減らす・止める・ゆっくり戻す計算を試せます。

端末のEd25519秘密鍵は取り出せない形で生成し、鍵と交換記録をIndexedDBに保存します。PWAの準備後は通信なしで開き直せます。対応しないブラウザでは理由を表示して停止します。サイトデータを削除すると鍵と記録を失います。

## 今回の実装

Node **87件**の検証が成功。既存の端末画面はv1の交換を保存し、受け取りを仮状態で表示します。新しいv2は双方の所有権バージョンと確定期限に署名し、厳格なQR形式と参照確定モデルで改変・競合・再送・期限・上限を検査します。参照モデルはブロックチェーン上の確定ではありません。Anchorの実アカウント・署名検査・二人分の所有権を同時に更新する処理と、ローカルSolana用の検証コードを追加しました。Rustの15件の検証と、ローカルSolana上の22種類の実行検証が成功しています。プログラムは公開Solana devnetに配置済みです（下記）。

混雑計算は元のPythonから作ったallocation128、governor54の検証値と一致します。運営側の停止指定と、同じ配布期間で急に再開しないルールも検査します。**stylised model, not calibrated**。計算モデルであり、実会場の観測値・誘導実績・混雑改善の証拠ではありません。

ももとるる、3ステップの案内、交換成功の反応、パステルの画面は外部画像やフォントを読み込まず動きます。レア・完成の反応部品も用意していますが、全体ゲームへの接続は制作中です。

## Solana devnet

TONARIプログラムを公開devnetに配置しました（2026-10-05 JST）。

- Program ID：[`2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA`](https://explorer.solana.com/address/2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA?cluster=devnet)
- 配置トランザクション：[`42ErvF5Q…`](https://explorer.solana.com/tx/42ErvF5QueKydGTKG3WvCjgnAuuPLuctkjrrrFbkcjrVNdrK21NcP9Qk2V1oufPipTbQcQPw6iAihBtnsKQoh1mK?cluster=devnet)
- devnet上の確認トランザクション（create_show / register_ticket / issue_tile / settle_swap）と手順は [devnet配置記録](docs/DEVNET_DEPLOY.md) にあります。

アップグレード権限はdevnet用の運用鍵が持ち、不変の配置ではありません。交換画面は、ローカル検証とDevnetの設定を区別して受け付けます。Devnetの確定後は取引のExplorerリンクを表示します。運用者向けの接続手順は [Devnet接続](docs/R1M_DEVNET_RELAY.md) にあります。GitHub Pagesの静的デモには確定用サーバーがなく、審査員向けの常設接続はまだ制作中です。devnet SOLは無料のテスト用で、実際のお金は使っていません。

## ブラウザでの回帰検証

PlaywrightとChromeを用意し、デモサーバー起動後に実行します。

```sh
node tests/storage-browser.cjs
node tests/browser-check.cjs
node tests/qr-browser.cjs
node tests/operations-browser.cjs
node tests/brand-browser.cjs
```

`TONARI_PLAYWRIGHT` と `TONARI_CHROME_PATH` でインストール先を指定できます。

## これから完成させるもの

画面とSolana devnetの交換確定の常設接続、claims/revealと検証CLI、配布・offers/VQ・全体シミュレーション、ゲーム、審査員が一人で最後まで試せるデモ、記念cNFT、動画・提出文。内部の進捗と未解決事項は [R1h](docs/R1H_CHAIN.md) に記載しています。

無料・賞品なし・記念のみ。売買・転売や会場との提携・導入実績は主張しません。完成記録は譲渡できない記念品として設計中です。将来のセンサー接続の説明は **sensor-adapter ready, demoed with a simulated feed** とします。

[プロトコル](docs/PROTOCOL.md) · [構成](docs/ARCHITECTURE.md) · [第三者ライセンス](docs/THIRD_PARTY.md) · [配布モデル](docs/R1_ALLOCATOR.md)
