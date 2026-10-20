import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const medications = await prisma.medication.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(medications);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch medications" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      category,
      unit,
      stockQuantity,
      minThreshold,
      indications,
    } = body;
    if (
      !id ||
      !name ||
      !unit ||
      !name.trim() || !unit.trim() ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 ||
      !Number.isSafeInteger(minThreshold) || minThreshold < 0
    ) {
      return NextResponse.json(
        { error: "Medication information is incomplete" },
        { status: 400 },
      );
    }
    const medication = await prisma.medication.update({
      where: { id },
      data: {
        name,
        category: category || "ยาทั่วไป",
        unit,
        stockQuantity: Number(stockQuantity),
        minThreshold: Number(minThreshold),
        indications: indications || null,
      },
    });
    return NextResponse.json(medication);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update medication" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, unit, stockQuantity, minThreshold, indications } =
      body;
    if (
      !name ||
      !unit ||
      !name.trim() || !unit.trim() ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 ||
      !Number.isSafeInteger(minThreshold) || minThreshold < 0
    ) {
      return NextResponse.json(
        { error: "Medication information is incomplete" },
        { status: 400 },
      );
    }
    const medication = await prisma.medication.create({
      data: {
        name,
        category: category || "ยาทั่วไป",
        unit,
        stockQuantity: Number(stockQuantity),
        minThreshold: Number(minThreshold),
        indications: indications || null,
      },
    });
    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create medication" },
      { status: 500 },
    );
  }
}
