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
  });

  it("Is paused!", async () => {
  console.log("Step 1: Deposit and withdraw");
  const tx1 = await program.methods.deposit(new BN(1_000_000))
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      bankVault: BANK_APP_ACCOUNTS.bankVault,
      userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
      user: provider.publicKey,
      systemProgram: SystemProgram.programId
    }).rpc();
  console.log("Deposit signature: ", tx1);

  let userReserve = await program.account.userReserve.fetch(
    BANK_APP_ACCOUNTS.userReserve(provider.publicKey)
  );
  console.log("User reserve: ", userReserve.depositedAmount.toString());

  const tx2 = await program.methods.withdraw(new BN(500_000))
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      bankVault: BANK_APP_ACCOUNTS.bankVault,
      userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
      user: provider.publicKey,
      systemProgram: SystemProgram.programId
    }).rpc();
  console.log("Withdraw signature: ", tx2);

  userReserve = await program.account.userReserve.fetch(
    BANK_APP_ACCOUNTS.userReserve(provider.publicKey)
  );
  console.log("User reserve: ", userReserve.depositedAmount.toString());

  console.log("Step 2: Pause, then use deposit and withdraw");
  const tx3 = await program.methods.togglePause()
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      authority: provider.publicKey,
    }).rpc();
  console.log("Paused signature: ", tx3);

  // deposit should fail
  try {
    await program.methods.deposit(new BN(1_000_000))
      .accountsStrict({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
        user: provider.publicKey,
        systemProgram: SystemProgram.programId
      }).rpc();

    throw new Error("Error! Deposit unexpectedly succeeded while paused");
  } catch {
    console.log("Deposit blocked successfully");
  }

  // withdraw should fail
  try {
    await program.methods.withdraw(new BN(500_000))
      .accountsStrict({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
        user: provider.publicKey,
        systemProgram: SystemProgram.programId
      }).rpc();

    throw new Error("Error! Withdraw unexpectedly succeeded while paused");
  } catch {
    console.log("Withdraw blocked successfully");
  }

  console.log("Step 3: Continue, then use deposit and withdraw");
  const tx4 = await program.methods.togglePause()
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      authority: provider.publicKey,
    }).rpc();
  console.log("Unpaused signature: ", tx4);

  const tx5 = await program.methods.deposit(new BN(1_000_000))
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      bankVault: BANK_APP_ACCOUNTS.bankVault,
      userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
      user: provider.publicKey,
      systemProgram: SystemProgram.programId
    }).rpc();
  console.log("Deposit signature: ", tx5);

  userReserve = await program.account.userReserve.fetch(
    BANK_APP_ACCOUNTS.userReserve(provider.publicKey)
  );
  console.log("User reserve: ", userReserve.depositedAmount.toString());

  const tx6 = await program.methods.withdraw(new BN(500_000))
    .accountsStrict({
      bankInfo: BANK_APP_ACCOUNTS.bankInfo,
      bankVault: BANK_APP_ACCOUNTS.bankVault,
      userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
      user: provider.publicKey,
      systemProgram: SystemProgram.programId
    }).rpc();
  console.log("Withdraw signature: ", tx6);
});

});