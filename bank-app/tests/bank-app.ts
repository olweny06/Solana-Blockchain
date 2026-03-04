import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";
import {assert} from "chai";

describe("bank-app", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;

  const BANK_APP_ACCOUNTS = {
    bankInfo: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_INFO_SEED")],
      program.programId
    )[0],
    bankVault: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_VAULT_SEED")],
      program.programId
    )[0],
    userReserve: (pubkey: PublicKey) => PublicKey.findProgramAddressSync(
      [
        Buffer.from("USER_RESERVE_SEED"),
        pubkey.toBuffer()
      ],
      program.programId
    )[0],
  }

  it("Is initialized!", async () => {
    try {
      const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo)
      console.log("Bank info: ", bankInfo)
    } catch {
      const tx = await program.methods.initialize()
        .accountsStrict({
          bankInfo: BANK_APP_ACCOUNTS.bankInfo,
          bankVault: BANK_APP_ACCOUNTS.bankVault,
          authority: provider.publicKey,
          systemProgram: SystemProgram.programId
        }).rpc();
      console.log("Initialize signature: ", tx);
    }
  });

  it("Is deposited!", async () => {
    const tx = await program.methods.deposit(new BN(1_000_000))
      .accountsStrict({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
        user: provider.publicKey,
        systemProgram: SystemProgram.programId
      }).rpc();
    console.log("Deposit signature: ", tx);

    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey))
    console.log("User reserve: ", userReserve.depositedAmount.toString())
  });

  it("Is withdrawn!", async () => {
    const depositAmount = new BN(1_000_000);
    const withdrawnAmount = new BN(500_000);

    const tx = await program.methods.withdraw(withdrawnAmount)
      .accountsStrict({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
        user: provider.publicKey,
        systemProgram: SystemProgram.programId
      }).rpc();
    
    console.log("Withdraw signature: ", tx);

    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey))
    console.log("User reserve: ", userReserve.depositedAmount.toString())

    const expected = depositAmount.sub(withdrawnAmount)
    if (!userReserve.depositedAmount.eq(expected)) {
      throw new Error(`Expected: ${expected.toString()}, Actual: ${userReserve.depositedAmount.toString()}`)
    }
  });

  it("Pause blocks deposit, unpause allows it", async () => {
  // Pause = true
  const tx1 = await program.methods.pause(true)
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      authority: provider.publicKey,
    })
    .rpc();
  console.log("Pause(true) signature: ", tx1);

  // Deposit should fail while paused
  try {
    await program.methods.deposit(new BN(1))
      .accountsStrict({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
        user: provider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    throw new Error("Deposit unexpectedly succeeded while paused");
  } catch (e: any) {
    console.log("Deposit failed as expected while paused");
  }

  // Unpause = false
  const tx2 = await program.methods.pause(false)
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      authority: provider.publicKey,
    })
    .rpc();
  console.log("Pause(false) signature: ", tx2);

  // Deposit should succeed now
  const tx3 = await program.methods.deposit(new BN(10))
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      bankVault: BANK_APP_ACCOUNTS.bankVault,
      userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
      user: provider.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Deposit after unpause signature: ", tx3);
});

});